import WebSocket from "ws";
import type { Ship } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 20;

// ============================================================================
// Real global AIS via aisstream.io (WebSocket). Serverless functions can't hold
// a socket open across requests, so each refresh opens the stream, gathers a
// few seconds of position reports worldwide, dedupes by MMSI, and returns a
// snapshot. The client interpolates between snapshots (course + speed) so
// vessels glide smoothly. We cache the snapshot for FRESH_TTL so the stream is
// only opened ~once every 30s no matter how many clients poll, and fall back to
// a coherent synthetic feed if the key is missing or the stream fails.
// ============================================================================

const GATHER_MS = 6000; // how long to listen before returning a snapshot
const MAX_SHIPS = 4000;
const FRESH_TTL = 30_000;
const STALE_TTL = 10 * 60_000;

let cache: { items: Ship[]; ts: number; source: string } | null = null;
let inflight: Promise<Ship[]> | null = null;

// Persistent (across requests, while the lambda stays warm) accumulator of AIS
// type-5 static data keyed by MMSI. Static messages are broadcast only every
// ~6 min, so any single snapshot sees very few — but by remembering them we
// build up particulars (IMO, dimensions, callsign, ETA…) for more and more
// vessels the longer the app runs. Capped so it can't grow without bound.
const staticCache = new Map<number, AisStatic>();
const STATIC_CACHE_MAX = 60_000;

// ---- AIS code → label maps ----
function shipType(t?: number): string {
  if (t == null) return "VESSEL";
  if (t >= 70 && t <= 79) return "CARGO";
  if (t >= 80 && t <= 89) return "TANKER";
  if (t >= 60 && t <= 69) return "PASSENGER";
  if (t >= 40 && t <= 49) return "HIGH-SPEED";
  if (t >= 50 && t <= 59) return "SPECIAL CRAFT";
  if (t === 30) return "FISHING";
  if (t === 31 || t === 32 || t === 52) return "TUG";
  if (t === 36) return "SAILING";
  if (t === 37) return "PLEASURE CRAFT";
  return "VESSEL";
}

const NAV_STATUS: Record<number, string> = {
  0: "UNDER WAY (ENGINE)",
  1: "AT ANCHOR",
  2: "NOT UNDER COMMAND",
  3: "RESTRICTED MANOEUVRE",
  4: "CONSTRAINED BY DRAUGHT",
  5: "MOORED",
  6: "AGROUND",
  7: "FISHING",
  8: "UNDER WAY (SAILING)",
};

// MMSI MID (first 3 digits) → flag. Common maritime nations; falls back to "".
const MID_FLAG: Record<string, string> = {
  "201": "ALBANIA", "205": "BELGIUM", "209": "CYPRUS", "211": "GERMANY",
  "219": "DENMARK", "224": "SPAIN", "226": "FRANCE", "227": "FRANCE",
  "232": "UK", "233": "UK", "235": "UK", "236": "GIBRALTAR", "237": "GREECE",
  "238": "CROATIA", "244": "NETHERLANDS", "245": "NETHERLANDS", "247": "ITALY",
  "248": "MALTA", "249": "MALTA", "256": "MALTA", "257": "NORWAY",
  "258": "NORWAY", "259": "NORWAY", "265": "SWEDEN", "266": "SWEDEN",
  "269": "SWITZERLAND", "271": "TURKEY", "273": "RUSSIA", "304": "ANTIGUA",
  "305": "ANTIGUA", "308": "BAHAMAS", "309": "BAHAMAS", "311": "BAHAMAS",
  "316": "CANADA", "338": "USA", "351": "PANAMA", "352": "PANAMA",
  "353": "PANAMA", "354": "PANAMA", "355": "PANAMA", "356": "PANAMA",
  "357": "PANAMA", "366": "USA", "367": "USA", "368": "USA", "369": "USA",
  "370": "PANAMA", "371": "PANAMA", "372": "PANAMA", "373": "PANAMA",
  "374": "PANAMA", "412": "CHINA", "413": "CHINA", "416": "TAIWAN",
  "431": "JAPAN", "432": "JAPAN", "440": "S.KOREA", "441": "S.KOREA",
  "477": "HONG KONG", "525": "INDONESIA", "563": "SINGAPORE",
  "564": "SINGAPORE", "565": "SINGAPORE", "566": "SINGAPORE", "574": "VIETNAM",
  "636": "LIBERIA", "637": "LIBERIA", "657": "NIGERIA", "710": "BRAZIL",
  "725": "CHILE", "773": "URUGUAY",
};
function flagOf(mmsi: number): string | undefined {
  return MID_FLAG[String(mmsi).slice(0, 3)];
}

// ---------- aisstream message shapes (only the fields we read) ----------
interface AisMeta {
  MMSI: number;
  ShipName?: string;
  latitude?: number;
  longitude?: number;
  time_utc?: string;
}
interface AisPosition {
  Cog?: number;
  Sog?: number;
  TrueHeading?: number;
  Latitude?: number;
  Longitude?: number;
  NavigationalStatus?: number;
}
interface AisStatic {
  Type?: number;
  Destination?: string;
  ImoNumber?: number;
  CallSign?: string;
  MaximumStaticDraught?: number;
  Dimension?: { A?: number; B?: number; C?: number; D?: number };
  Eta?: { Month?: number; Day?: number; Hour?: number; Minute?: number };
}

// AIS dimensions are distances from the transponder to bow (A), stern (B),
// port (C) and starboard (D); length = A+B, beam = C+D.
function dims(d?: AisStatic["Dimension"]): { length?: number; beam?: number } {
  if (!d) return {};
  const length = (d.A ?? 0) + (d.B ?? 0);
  const beam = (d.C ?? 0) + (d.D ?? 0);
  return { length: length || undefined, beam: beam || undefined };
}

function formatEta(e?: AisStatic["Eta"]): string | undefined {
  if (!e || !e.Month || !e.Day) return undefined; // month 0 / day 0 = N/A
  const hh = String(e.Hour ?? 0).padStart(2, "0");
  const mm = String(e.Minute ?? 0).padStart(2, "0");
  if ((e.Hour ?? 24) >= 24) return undefined;
  return `${String(e.Day).padStart(2, "0")}/${String(e.Month).padStart(2, "0")} ${hh}:${mm}Z`;
}
interface AisMessage {
  MessageType: string;
  MetaData: AisMeta;
  Message: {
    PositionReport?: AisPosition;
    ShipStaticData?: AisStatic;
  };
}

function gatherSnapshot(apiKey: string): Promise<Ship[]> {
  return new Promise((resolve, reject) => {
    const positions = new Map<number, Ship>();
    let settled = false;

    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (err && positions.size === 0) return reject(err);
      // merge accumulated static data (type / particulars) into positions
      const ships: Ship[] = [];
      for (const [mmsi, s] of positions) {
        const st = staticCache.get(mmsi);
        const { length, beam } = dims(st?.Dimension);
        ships.push({
          ...s,
          type: shipType(st?.Type),
          destination: st?.Destination?.trim() || undefined,
          imo: st?.ImoNumber || undefined,
          callsign: st?.CallSign?.trim() || undefined,
          draught: st?.MaximumStaticDraught || undefined,
          eta: formatEta(st?.Eta),
          length,
          beam,
        });
      }
      resolve(ships.slice(0, MAX_SHIPS));
    };

    const timer = setTimeout(() => finish(), GATHER_MS);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [
            [
              [-90, -180],
              [90, 180],
            ],
          ],
          FilterMessageTypes: ["PositionReport", "ShipStaticData"],
        })
      );
    });

    ws.on("message", (raw: Buffer) => {
      let msg: AisMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const meta = msg.MetaData;
      if (!meta || typeof meta.MMSI !== "number") return;

      if (msg.MessageType === "ShipStaticData" && msg.Message.ShipStaticData) {
        if (
          staticCache.size < STATIC_CACHE_MAX ||
          staticCache.has(meta.MMSI)
        ) {
          staticCache.set(meta.MMSI, msg.Message.ShipStaticData);
        }
        return;
      }

      const pr = msg.Message.PositionReport;
      if (!pr) return;
      const lat = pr.Latitude ?? meta.latitude;
      const lon = pr.Longitude ?? meta.longitude;
      if (typeof lat !== "number" || typeof lon !== "number") return;

      positions.set(meta.MMSI, {
        id: String(meta.MMSI),
        name: meta.ShipName?.trim() || `MMSI ${meta.MMSI}`,
        lat,
        lon,
        heading: pr.Cog ?? pr.TrueHeading ?? 0,
        speed: pr.Sog ?? 0, // knots
        type: "VESSEL",
        status:
          pr.NavigationalStatus != null
            ? NAV_STATUS[pr.NavigationalStatus]
            : undefined,
        flag: flagOf(meta.MMSI),
        timePosition: meta.time_utc ? Date.parse(meta.time_utc) : Date.now(),
      });

      if (positions.size >= MAX_SHIPS) finish();
    });

    ws.on("error", (e: Error) => finish(e));
    ws.on("close", () => finish());
  });
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < FRESH_TTL) {
    return Response.json({ items: cache.items, source: cache.source, live: true });
  }

  const apiKey = process.env.AISSTREAM_API_KEY;
  if (!apiKey) {
    return Response.json({ items: syntheticShips(), source: "sim-ais", live: false });
  }

  try {
    // de-dupe concurrent cold requests onto one stream open
    if (!inflight) inflight = gatherSnapshot(apiKey);
    const items = await inflight;
    inflight = null;
    if (items.length) {
      cache = { items, ts: Date.now(), source: "aisstream" };
      return Response.json({ items, source: "aisstream", live: true });
    }
  } catch (e) {
    inflight = null;
    console.error("[ships] aisstream failed:", e);
  }

  if (cache && now - cache.ts < STALE_TTL) {
    return Response.json({ items: cache.items, source: `${cache.source}-cached`, live: true });
  }
  return Response.json({ items: syntheticShips(), source: "sim-ais", live: false });
}

// ---- coherent synthetic fallback (used only if the key/stream is unavailable) ----
const LANES: [number, number, string][] = [
  [4.0, 51.9, "ROTTERDAM"],
  [121.8, 31.2, "SHANGHAI"],
  [-118.25, 33.72, "SAN PEDRO"],
  [55.05, 25.0, "JEBEL ALI"],
  [103.7, 1.26, "SINGAPORE"],
  [32.35, 31.25, "SUEZ"],
  [-79.9, 9.35, "PANAMA"],
];
const TYPES = ["CARGO", "TANKER", "CONTAINER", "BULK CARRIER", "RO-RO", "LNG"];

function syntheticShips(): Ship[] {
  const t = Date.now() / 1000;
  const items: Ship[] = [];
  let n = 0;
  for (const [lon, lat, area] of LANES) {
    for (let i = 0; i < 14; i++) {
      const phase = (n * 1.7 + t / 90) % (Math.PI * 2);
      const spread = ((i % 7) - 3) * 0.35;
      items.push({
        id: `MMSI${200000000 + n}`,
        name: `${area} ${n}`,
        lon: lon + Math.cos(phase) * 0.6 + spread,
        lat: lat + Math.sin(phase) * 0.45 + spread * 0.4,
        heading: (Math.cos(phase) * 180 + 180) % 360,
        type: TYPES[(n + i) % TYPES.length],
        speed: 6 + ((n * 7 + i * 3) % 16),
        timePosition: Date.now(),
      });
      n++;
    }
  }
  return items;
}
