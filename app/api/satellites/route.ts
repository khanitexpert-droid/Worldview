import * as satellite from "satellite.js";
import type { Satellite } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Primary: TLE API (fast, fresh daily TLEs, reachable).
//   https://tle.ivanstanojevic.me/api/tle/
// Fallback: CelesTrak "visual" group (often slow / blocked, so secondary).
const TLE_API = "https://tle.ivanstanojevic.me/api/tle/?page-size=100";
const CELESTRAK =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";
const UA = "worldview-clone/1.0";

interface Tle {
  name: string;
  l1: string;
  l2: string;
}

// Pull TLEs from the JSON TLE API.
async function fromTleApi(): Promise<Tle[]> {
  const res = await fetch(TLE_API, {
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`tle-api ${res.status}`);
  const json = (await res.json()) as {
    member?: { name: string; line1: string; line2: string }[];
  };
  return (json.member ?? [])
    .filter((m) => m.line1?.startsWith("1 ") && m.line2?.startsWith("2 "))
    .map((m) => ({ name: m.name, l1: m.line1, l2: m.line2 }));
}

// Pull TLEs from CelesTrak's plain-text format.
async function fromCelestrak(): Promise<Tle[]> {
  const res = await fetch(CELESTRAK, {
    cache: "no-store",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`celestrak ${res.status}`);
  const lines = (await res.text()).split(/\r?\n/).filter((l) => l.trim());
  const out: Tle[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (l1?.startsWith("1 ") && l2?.startsWith("2 ")) {
      out.push({ name: lines[i].trim(), l1, l2 });
    }
  }
  return out;
}

export async function GET() {
  let tles: Tle[] = [];
  let source = "tle-api";

  try {
    tles = await fromTleApi();
  } catch {
    try {
      tles = await fromCelestrak();
      source = "celestrak";
    } catch (err) {
      return Response.json({
        items: [],
        source: "fallback",
        live: false,
        error: String(err),
      });
    }
  }

  // propagate each TLE to "now" → sub-satellite lat/lon/alt
  const now = new Date();
  const gmst = satellite.gstime(now);
  const items: Satellite[] = [];

  for (const t of tles) {
    try {
      const satrec = satellite.twoline2satrec(t.l1, t.l2);
      const pv = satellite.propagate(satrec, now);
      if (!pv || typeof pv.position === "boolean" || !pv.position) continue;
      const geo = satellite.eciToGeodetic(pv.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      items.push({
        id: t.l2.slice(2, 7).trim() || t.name,
        name: t.name,
        lat,
        lon,
        altKm: Math.round(geo.height),
      });
    } catch {
      // skip bad TLE
    }
  }

  return Response.json({ items, source, live: true });
}
