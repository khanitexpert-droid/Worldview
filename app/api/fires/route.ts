import type { Fire } from "@/lib/types";

export const dynamic = "force-dynamic";

// ACTIVE FIRES — real near-real-time thermal anomalies from NASA FIRMS (VIIRS).
// The map key is server-side only (never shipped to the browser). FIRMS rate-
// limits keys to 5,000 transactions / 10 min, so we fetch sparingly and let the
// CDN cache the result; the client also polls slowly (15 min).
//
// Area API (CSV): /api/area/csv/{KEY}/{SOURCE}/{AREA}/{DAY_RANGE}
//   SOURCE = VIIRS_SNPP_NRT (Suomi-NPP, near-real-time)
//   AREA   = world   DAY_RANGE = 1 (last 24h)
const SOURCE = "VIIRS_SNPP_NRT";
const DAY_RANGE = 1;
// world/day VIIRS can be tens of thousands of pixels; keep the globe smooth by
// rendering only the most intense detections (by fire radiative power). Still
// 100% real data — just the hottest fires first.
const MAX_FIRES = 4000;

interface FiresPayload {
  items: Fire[];
  source: string;
  live: boolean;
  fetchedAt: string;
  error?: string;
}

function json(payload: FiresPayload, sMaxAge: number) {
  return Response.json(payload, {
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400`,
    },
  });
}

// VIIRS CSV header:
// latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,
// instrument,confidence,version,bright_ti5,frp,daynight
function parseCsv(text: string): Fire[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const cols = lines[0].split(",").map((c) => c.trim());
  const idx = (name: string) => cols.indexOf(name);
  const iLat = idx("latitude");
  const iLon = idx("longitude");
  const iBright = idx("bright_ti4");
  const iDate = idx("acq_date");
  const iTime = idx("acq_time");
  const iSat = idx("satellite");
  const iConf = idx("confidence");
  const iFrp = idx("frp");
  const iDn = idx("daynight");
  if (iLat < 0 || iLon < 0) return [];

  const out: Fire[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(",");
    const lat = parseFloat(f[iLat]);
    const lon = parseFloat(f[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // acq_time is HHMM (UTC); build an epoch-ms timestamp from date + time
    const date = f[iDate];
    const hhmm = (f[iTime] ?? "0").padStart(4, "0");
    const acq = Date.parse(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`);
    out.push({
      id: `${lat.toFixed(4)},${lon.toFixed(4)},${date}${hhmm}`,
      lat,
      lon,
      brightness: iBright >= 0 ? parseFloat(f[iBright]) || 0 : 0,
      frp: iFrp >= 0 ? parseFloat(f[iFrp]) || 0 : 0,
      confidence: iConf >= 0 ? (f[iConf] ?? "").trim() : "",
      satellite: iSat >= 0 ? (f[iSat] ?? "").trim() : "",
      daynight: iDn >= 0 ? (f[iDn] ?? "").trim() : "",
      acq: Number.isFinite(acq) ? acq : Date.now(),
    });
  }
  return out;
}

export async function GET() {
  const key = process.env.FIRMS_MAP_KEY;
  // No key configured (e.g. not yet added in Vercel) → return empty so the layer
  // just stays dark instead of erroring.
  if (!key) {
    return json(
      {
        items: [],
        source: "NASA FIRMS (no key)",
        live: false,
        fetchedAt: new Date().toISOString(),
        error: "FIRMS_MAP_KEY not set",
      },
      20
    );
  }

  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${SOURCE}/world/${DAY_RANGE}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`FIRMS ${res.status}`);
    const text = await res.text();
    // FIRMS returns plain text errors (e.g. invalid key / over quota) with a 200
    if (text.startsWith("Invalid") || text.includes("Error")) {
      throw new Error(text.slice(0, 120));
    }
    let items = parseCsv(text);
    // keep the hottest fires (highest FRP) when over the render cap
    if (items.length > MAX_FIRES) {
      items = items.sort((a, b) => b.frp - a.frp).slice(0, MAX_FIRES);
    }
    return json(
      {
        items,
        source: "NASA FIRMS · VIIRS",
        live: items.length > 0,
        fetchedAt: new Date().toISOString(),
      },
      1800
    );
  } catch (err) {
    return json(
      {
        items: [],
        source: "NASA FIRMS (error)",
        live: false,
        fetchedAt: new Date().toISOString(),
        error: String(err),
      },
      60
    );
  }
}
