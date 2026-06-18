import type { Earthquake } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// USGS — all earthquakes, past day. No key required.
const USGS =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

interface UsgsFeature {
  id: string;
  properties: { place: string; mag: number; time: number };
  geometry: { coordinates: [number, number, number] };
}

export async function GET() {
  try {
    const res = await fetch(USGS, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`usgs ${res.status}`);
    const data = (await res.json()) as { features: UsgsFeature[] };

    const items: Earthquake[] = data.features
      .map((f) => ({
        id: f.id,
        place: f.properties.place ?? "Unknown region",
        mag: f.properties.mag ?? 0,
        time: f.properties.time,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depth: f.geometry.coordinates[2],
      }))
      .filter((e) => Number.isFinite(e.lon) && Number.isFinite(e.lat));

    return Response.json({ items, source: "usgs", live: true });
  } catch (err) {
    return Response.json({
      items: [],
      source: "fallback",
      live: false,
      error: String(err),
    });
  }
}
