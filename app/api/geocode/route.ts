// City / country search → OpenStreetMap Nominatim (free, no key). Proxied
// server-side so we can send a proper User-Agent (Nominatim usage policy) and
// cache per-query, instead of hammering it from every visitor's browser.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  // Nominatim order: [south, north, west, east]
  boundingbox?: [string, string, string, string];
  type?: string;
  class?: string;
}

export interface GeoResult {
  name: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number] | null; // [south, north, west, east]
  kind: string;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json({ results: [] });

  const url = `${NOMINATIM}?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "WORLDVIEW-globe (https://github.com/khanitexpert-droid/Worldview)",
        "Accept-Language": "en",
      },
      // results are stable; cache each query for a day to be a good citizen
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data = (await res.json()) as NominatimItem[];

    const results: GeoResult[] = data
      .map((d) => ({
        name: d.display_name,
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon),
        bbox: d.boundingbox
          ? (d.boundingbox.map(parseFloat) as [number, number, number, number])
          : null,
        kind: d.type ?? d.class ?? "",
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));

    return Response.json({ results });
  } catch (err) {
    return Response.json({ results: [], error: String(err) });
  }
}
