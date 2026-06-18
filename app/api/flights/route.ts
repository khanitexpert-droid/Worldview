import type { Flight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const UA = "worldview-clone/1.0";
const MAX_FLIGHTS = 6000;
const FT_TO_M = 0.3048;
const KN_TO_MS = 0.514444;

// ---- shared snapshot cache (the key to staying under OpenSky's throttle) ----
// Serve a cached snapshot for FRESH_TTL without hitting any upstream, so OpenSky
// is queried at most ~once every 30s no matter how often clients poll. The
// client interpolates between snapshots, so motion stays smooth despite the
// caching. On a total upstream failure we serve the last snapshot up to
// STALE_TTL old before falling back to a coherent synthetic feed.
let cache: { items: Flight[]; ts: number; source: string } | null = null;
const FRESH_TTL = 30_000;
const STALE_TTL = 10 * 60_000;

// =================== primary: OpenSky /states/all (global) ===================
const OPENSKY = "https://opensky-network.org/api/states/all";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
let tokenCache: { token: string; expires: number } | null = null;
let tokenCooldownUntil = 0;

async function getAccessToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const now = Date.now();
  if (tokenCache && now < tokenCache.expires) return tokenCache.token;
  if (now < tokenCooldownUntil) return null;
  try {
    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: id,
        client_secret: secret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`auth ${res.status}`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache = { token: j.access_token, expires: now + (j.expires_in - 60) * 1000 };
    return j.access_token;
  } catch (e) {
    console.error("[flights] token fetch failed; backing off 60s:", e);
    tokenCooldownUntil = now + 60_000;
    return null;
  }
}

async function fetchOpenSky(): Promise<Flight[]> {
  const token = await getAccessToken();
  const res = await fetch(OPENSKY, {
    cache: "no-store",
    headers: {
      "User-Agent": UA,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`opensky ${res.status}`);
  const data = (await res.json()) as { states: unknown[][] | null };
  // index map: 0 icao24,1 callsign,2 country,3 time_pos,4 last_contact,5 lon,
  // 6 lat,7 baro_alt,8 on_ground,9 velocity,10 true_track,11 vert_rate,13 geo_alt
  return (data.states ?? [])
    .map((s) => ({
      id: String(s[0]),
      callsign:
        (String(s[1] ?? "").trim() || String(s[0])).toUpperCase(),
      country: String(s[2] ?? ""),
      lon: Number(s[5]),
      lat: Number(s[6]),
      altitude: Number(s[13] ?? s[7] ?? 0),
      velocity: Number(s[9] ?? 0),
      heading: Number(s[10] ?? 0),
      verticalRate: Number(s[11] ?? 0),
      onGround: Boolean(s[8]),
      timePosition: (Number(s[3] ?? s[4]) || Date.now() / 1000) * 1000,
    }))
    .filter(
      (f) =>
        Number.isFinite(f.lon) &&
        Number.isFinite(f.lat) &&
        !(f.lon === 0 && f.lat === 0)
    )
    .slice(0, MAX_FLIGHTS);
}

// ============== fallback: free community ADS-B (radius-tiled) ===============
const AL = "api.airplanes.live";
const FI = "opendata.adsb.fi";
const LOL = "api.adsb.lol";
const REGIONS: [number, number, string][] = [
  [50, 5, AL], [51, 0, FI], [41, 14, LOL], [58, 14, AL], [50, 25, FI],
  [39, 33, LOL], [25, 52, AL], [-26, 28, FI], [40, -77, LOL], [29, -82, AL],
  [32, -97, FI], [41, -88, LOL], [36, -119, AL], [47, -122, FI], [20, -99, LOL],
  [-23, -46, AL], [22, 78, FI], [10, 100, LOL], [35, 138, AL], [25, 114, FI],
  [-33, 151, LOL],
];

interface AdsbAc {
  hex?: string; flight?: string; r?: string; t?: string; desc?: string;
  lat?: number; lon?: number; gs?: number; track?: number; mag_heading?: number;
  alt_baro?: number | "ground"; alt_geom?: number; baro_rate?: number;
  geom_rate?: number; seen_pos?: number;
}

function mapAdsb(a: AdsbAc): Flight | null {
  if (typeof a.lat !== "number" || typeof a.lon !== "number") return null;
  const onGround = a.alt_baro === "ground";
  const altFt = onGround
    ? 0
    : typeof a.alt_baro === "number"
      ? a.alt_baro
      : (a.alt_geom ?? 0);
  return {
    id: a.hex ?? `${a.lat},${a.lon}`,
    callsign:
      (a.flight ?? "").trim() || (a.r ?? "").trim() || (a.hex ?? "").toUpperCase(),
    country: "",
    lon: a.lon,
    lat: a.lat,
    altitude: altFt * FT_TO_M,
    velocity: (a.gs ?? 0) * KN_TO_MS,
    heading: a.track ?? a.mag_heading ?? 0,
    verticalRate: ((a.baro_rate ?? a.geom_rate ?? 0) * FT_TO_M) / 60,
    onGround,
    timePosition: Date.now() - (a.seen_pos ?? 0) * 1000,
    aircraftType: a.desc || a.t || undefined,
    registration: (a.r ?? "").trim() || undefined,
  };
}

async function fetchRegion(lat: number, lon: number, host: string): Promise<Flight[]> {
  const url =
    host === AL
      ? `https://${host}/v2/point/${lat}/${lon}/250`
      : host === FI
        ? `https://${host}/api/v2/lat/${lat}/lon/${lon}/dist/250`
        : `https://${host}/v2/lat/${lat}/lon/${lon}/dist/250`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  const json = (await res.json()) as { ac?: AdsbAc[] };
  return (json.ac ?? []).map(mapAdsb).filter((f): f is Flight => f !== null);
}

async function fetchAdsb(): Promise<Flight[]> {
  const results = await Promise.allSettled(
    REGIONS.map(([lat, lon, host]) => fetchRegion(lat, lon, host))
  );
  const byId = new Map<string, Flight>();
  for (const r of results) {
    if (r.status === "fulfilled") for (const f of r.value) byId.set(f.id, f);
  }
  if (byId.size === 0) throw new Error("all adsb regions failed");
  return [...byId.values()].slice(0, MAX_FLIGHTS);
}

// ================================ handler ===================================
export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < FRESH_TTL) {
    return Response.json({ items: cache.items, source: cache.source, live: true });
  }

  // primary: tiled community ADS-B (reliably reachable from Vercel)
  try {
    const items = await fetchAdsb();
    cache = { items, ts: Date.now(), source: "adsb" };
    return Response.json({ items, source: "adsb", live: true });
  } catch (e) {
    console.error("[flights] ADS-B failed, trying OpenSky:", e);
  }

  // last-ditch: OpenSky global snapshot (usually blocked from Vercel, but
  // full-global when reachable — e.g. local dev or other hosts)
  try {
    const items = await fetchOpenSky();
    if (items.length) {
      cache = { items, ts: Date.now(), source: "opensky" };
      return Response.json({ items, source: "opensky", live: true });
    }
  } catch (e) {
    console.error("[flights] OpenSky failed:", e);
  }

  // serve a recent snapshot if we have one, else coherent synthetic
  if (cache && now - cache.ts < STALE_TTL) {
    return Response.json({ items: cache.items, source: `${cache.source}-cached`, live: true });
  }
  return Response.json({ items: syntheticFlights(), source: "fallback", live: false });
}

// Deterministic, time-based synthetic feed — identical across requests and
// continuous, so it glides instead of teleporting.
function syntheticFlights(): Flight[] {
  const t = Date.now() / 1000;
  const rand = (i: number, n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const out: Flight[] = [];
  for (let i = 0; i < 240; i++) {
    const lat = -55 + rand(i, 1) * 110;
    const lon0 = -180 + rand(i, 2) * 360;
    const speed = 180 + rand(i, 3) * 120;
    const dir = rand(i, 4) < 0.5 ? 1 : -1;
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
    let lon = lon0 + (dir * speed * t) / (111_320 * cosLat);
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    out.push({
      id: `SIM${i}`,
      callsign: `WV${100 + i}`,
      country: "SIMULATED",
      lon,
      lat,
      altitude: 8000 + rand(i, 5) * 4000,
      velocity: speed,
      heading: dir > 0 ? 90 : 270,
      verticalRate: 0,
      onGround: false,
      timePosition: Date.now(),
    });
  }
  return out;
}
