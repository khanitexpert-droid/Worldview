import * as satellite from "satellite.js";
import type { Satellite } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// CelesTrak "visual" group (brightest sats) as TLEs. No key required.
const CELESTRAK =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";

export async function GET() {
  try {
    const res = await fetch(CELESTRAK, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`celestrak ${res.status}`);
    const text = await res.text();

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    const now = new Date();
    const gmst = satellite.gstime(now);
    const items: Satellite[] = [];

    for (let i = 0; i + 2 < lines.length; i += 3) {
      const name = lines[i].trim();
      const l1 = lines[i + 1];
      const l2 = lines[i + 2];
      if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) continue;
      try {
        const satrec = satellite.twoline2satrec(l1, l2);
        const pv = satellite.propagate(satrec, now);
        if (!pv || typeof pv.position === "boolean" || !pv.position) continue;
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        items.push({
          id: l2.slice(2, 7).trim() || name,
          name,
          lat,
          lon,
          altKm: Math.round(geo.height),
        });
      } catch {
        // skip bad TLE
      }
    }

    return Response.json({ items, source: "celestrak", live: true });
  } catch (err) {
    return Response.json({
      items: [],
      source: "fallback",
      live: false,
      error: String(err),
    });
  }
}
