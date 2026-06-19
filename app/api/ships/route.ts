import type { Ship } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 20;

// ============================================================================
// Real AIS via VesselAPI (HTTP/REST — works from Vercel, unlike the aisstream
// WebSocket which only streams to residential IPs). Each bounding-box query is
// capped at 50 vessels and a 4° total span, so we sweep ~15 boxes over the
// world's busiest ports / chokepoints and merge them. Cached so upstream is hit
// at most ~once per FRESH_TTL no matter how many clients poll; the client
// interpolates between snapshots. Falls back to a synthetic feed if the key is
// missing or the API fails.
// ============================================================================

const BASE = "https://api.vesselapi.com/v1/location/vessels/bounding-box";
// Refresh upstream sparingly to stay well under VesselAPI's free-tier quota —
// the client dead-reckons ship positions between snapshots, so a 5-min refresh
// still looks live. With ~8 regions that's ~8 upstream calls per 5 min while
// the site is being viewed (and zero when nobody is on it).
const FRESH_TTL = 5 * 60_000;
const STALE_TTL = 30 * 60_000;
const PER_BOX = 50;

let cache: { items: Ship[]; ts: number; source: string } | null = null;
let inflight: Promise<Ship[]> | null = null;

// A small set of the world's busiest maritime hubs, spread across regions for a
// global look. Each box keeps |dLat| + |dLon| <= 4 (VesselAPI's span limit) and
// returns up to 50 vessels — ~400 ships total. Kept short on purpose to limit
// upstream request volume (see FRESH_TTL note above).
const REGIONS: [number, number, number, number][] = [
  [51.0, 53.0, 2.0, 4.0], // North Sea / Rotterdam
  [50.0, 51.5, 0.0, 1.8], // English Channel / Dover
  [35.7, 36.6, -6.0, -4.8], // Gibraltar
  [31.0, 32.0, 32.0, 33.4], // Suez / Port Said
  [24.8, 26.2, 54.8, 56.2], // Persian Gulf / Hormuz / Dubai
  [0.8, 1.7, 103.4, 104.5], // Singapore Strait
  [30.5, 31.9, 121.4, 122.8], // Shanghai / Yangtze
  [40.3, 41.0, -74.4, -73.6], // New York / New Jersey
];

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

// VesselAPI vessel_type is a free-text string ("Container Ship", "Oil Tanker"…)
function vesselType(t?: string): string {
  if (!t) return "VESSEL";
  const s = t.toLowerCase();
  if (s.includes("tanker")) return "TANKER";
  if (/cargo|container|bulk|carrier|freight/.test(s)) return "CARGO";
  if (/passenger|cruise|ferry/.test(s)) return "PASSENGER";
  if (s.includes("tug")) return "TUG";
  if (s.includes("fishing")) return "FISHING";
  if (/sailing|pleasure|yacht/.test(s)) return "SAILING";
  if (/high.?speed|hsc/.test(s)) return "HIGH-SPEED";
  return "VESSEL";
}

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

interface VaVessel {
  mmsi: number;
  imo?: number;
  vessel_name?: string;
  latitude: number;
  longitude: number;
  cog?: number;
  sog?: number;
  heading?: number;
  nav_status?: number;
  vessel_type?: string;
  timestamp?: string;
}

async function fetchRegion(
  apiKey: string,
  [latB, latT, lonL, lonR]: [number, number, number, number]
): Promise<Ship[]> {
  const url =
    `${BASE}?filter.latBottom=${latB}&filter.latTop=${latT}` +
    `&filter.lonLeft=${lonL}&filter.lonRight=${lonR}&pagination.limit=${PER_BOX}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`vesselapi ${res.status}`);
  const json = (await res.json()) as { vessels?: VaVessel[] };
  return (json.vessels ?? [])
    .filter((v) => typeof v.latitude === "number" && typeof v.longitude === "number")
    .map((v) => ({
      id: String(v.mmsi),
      name: v.vessel_name?.trim() || `MMSI ${v.mmsi}`,
      lat: v.latitude,
      lon: v.longitude,
      heading: v.cog ?? v.heading ?? 0,
      speed: v.sog ?? 0,
      type: vesselType(v.vessel_type),
      status: v.nav_status != null ? NAV_STATUS[v.nav_status] : undefined,
      flag: flagOf(v.mmsi),
      imo: v.imo || undefined,
      timePosition: v.timestamp ? Date.parse(v.timestamp) : Date.now(),
    }));
}

async function fetchVesselApi(apiKey: string): Promise<Ship[]> {
  const results = await Promise.allSettled(
    REGIONS.map((box) => fetchRegion(apiKey, box))
  );
  const byId = new Map<string, Ship>();
  let ok = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      ok++;
      for (const s of r.value) byId.set(s.id, s);
    }
  }
  if (ok === 0) throw new Error("all vesselapi regions failed");
  return [...byId.values()];
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < FRESH_TTL) {
    return Response.json({ items: cache.items, source: cache.source, live: true });
  }

  const apiKey = process.env.VESSELAPI_API_KEY;
  if (!apiKey) {
    return Response.json({ items: syntheticShips(), source: "sim-ais", live: false });
  }

  try {
    if (!inflight) inflight = fetchVesselApi(apiKey);
    const items = await inflight;
    inflight = null;
    if (items.length) {
      cache = { items, ts: Date.now(), source: "vesselapi" };
      return Response.json({ items, source: "vesselapi", live: true });
    }
  } catch (e) {
    inflight = null;
    console.error("[ships] vesselapi failed:", e);
  }

  if (cache && now - cache.ts < STALE_TTL) {
    return Response.json({ items: cache.items, source: `${cache.source}-cached`, live: true });
  }
  return Response.json({ items: syntheticShips(), source: "sim-ais", live: false });
}

// ---- coherent synthetic fallback (used only if the key/API is unavailable) ----
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
