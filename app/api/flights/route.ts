import type { Flight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

// Live ADS-B from community feeds (airplanes.live / adsb.fi). No login — so,
// unlike OpenSky, these aren't blocked from datacenter IPs like Vercel's.
// They're radius-limited (max 250nm/point), so we query several anchor points
// across the busy regions of the globe and merge them. Same response shape.
const UA = "worldview-clone/1.0";
const MAX_FLIGHTS = 6000;

// [lat, lon, host] — alternated across the two mirrors to spread rate limits.
const AL = "api.airplanes.live";
const FI = "opendata.adsb.fi";
const REGIONS: [number, number, string][] = [
  [50, 5, AL], // Europe (west/central)
  [40, -77, FI], // US northeast
  [37, -120, AL], // US west
  [25, 52, FI], // Gulf / Middle East
  [8, 100, AL], // Southeast Asia
  [35, 132, FI], // East Asia (Japan/Korea)
  [22, 78, AL], // South Asia (India)
  [-26, 28, FI], // Southern Africa
];

interface AdsbAc {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  lat?: number;
  lon?: number;
  gs?: number; // ground speed, knots
  track?: number; // deg
  mag_heading?: number;
  alt_baro?: number | "ground";
  alt_geom?: number;
  baro_rate?: number; // ft/min
  geom_rate?: number;
  seen_pos?: number; // seconds since position seen
}

const FT_TO_M = 0.3048;
const KN_TO_MS = 0.514444;

// in-memory cache so repeated client polls don't re-hit the feeds every time
let cache: { items: Flight[]; ts: number } | null = null;
const CACHE_TTL = 8000;

function mapAircraft(a: AdsbAc): Flight | null {
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

async function fetchRegion(
  lat: number,
  lon: number,
  host: string
): Promise<Flight[]> {
  // the two mirrors use different URL schemes for the same data
  const url =
    host === AL
      ? `https://${host}/v2/point/${lat}/${lon}/250`
      : `https://${host}/api/v2/lat/${lat}/lon/${lon}/dist/250`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  const json = (await res.json()) as { ac?: AdsbAc[] };
  return (json.ac ?? [])
    .map(mapAircraft)
    .filter((f): f is Flight => f !== null);
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return Response.json({ items: cache.items, source: "adsb", live: true });
  }

  const results = await Promise.allSettled(
    REGIONS.map(([lat, lon, host]) => fetchRegion(lat, lon, host))
  );

  // merge + dedupe by aircraft id
  const byId = new Map<string, Flight>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const f of r.value) byId.set(f.id, f);
    }
  }

  if (byId.size > 0) {
    const items = [...byId.values()].slice(0, MAX_FLIGHTS);
    cache = { items, ts: Date.now() };
    return Response.json({ items, source: "adsb", live: true });
  }

  // everything failed — serve recent cache if we have it, else coherent sim
  if (cache && Date.now() - cache.ts < 10 * 60 * 1000) {
    return Response.json({ items: cache.items, source: "adsb-cached", live: true });
  }
  return Response.json({
    items: syntheticFlights(),
    source: "fallback",
    live: false,
  });
}

// Deterministic, time-based synthetic feed. Each plane's position is a pure
// function of the clock, so it's identical across requests and moves smoothly
// (no per-request re-randomisation, which is what made the old one teleport).
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
    const speed = 180 + rand(i, 3) * 120; // m/s
    const dir = rand(i, 4) < 0.5 ? 1 : -1; // east / west
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
