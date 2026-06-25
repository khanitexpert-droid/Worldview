// Shared geo helpers for the INFRA fetch scripts: a point-in-polygon country
// labeller and per-country centroids, both built from the bundled Natural Earth
// borders (public/countries.geojson). Keeps each fetch script lean.
import { readFile } from "node:fs/promises";

export async function loadCountries() {
  return JSON.parse(
    await readFile(new URL("../public/countries.geojson", import.meta.url), "utf8")
  );
}

function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1],
      xj = ring[j][0],
      yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function polyContains(poly, x, y) {
  if (!ringContains(poly[0], x, y)) return false;
  for (let h = 1; h < poly.length; h++) if (ringContains(poly[h], x, y)) return false;
  return true;
}

/** Returns (lon,lat) -> country name, using bbox pre-filtering for speed. */
export async function buildCountryLookup(geo) {
  geo = geo || (await loadCountries());
  const polys = [];
  for (const f of geo.features || []) {
    const name = f.properties?.ADMIN || f.properties?.NAME || "";
    const g = f.geometry;
    if (!g) continue;
    const add = (poly) => {
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const [x, y] of poly[0]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      polys.push({ name, bbox: [minX, minY, maxX, maxY], poly });
    };
    if (g.type === "Polygon") add(g.coordinates);
    else if (g.type === "MultiPolygon") g.coordinates.forEach(add);
  }
  return (lon, lat) => {
    for (const p of polys) {
      const b = p.bbox;
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
      if (polyContains(p.poly, lon, lat)) return p.name;
    }
    return "";
  };
}

/** Area-weighted-ish centroid of a country (largest ring), keyed by ISO-A3. */
export async function countryCentroids(geo) {
  geo = geo || (await loadCountries());
  const out = new Map(); // iso3 -> { name, lon, lat }
  for (const f of geo.features || []) {
    const p = f.properties || {};
    const iso3 = p.ISO_A3 && p.ISO_A3 !== "-99" ? p.ISO_A3 : p.ADM0_A3;
    if (!iso3) continue;
    const g = f.geometry;
    if (!g) continue;
    // pick the ring with the largest bbox area as the mainland
    let best = null,
      bestArea = -1;
    const consider = (ring) => {
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const area = (maxX - minX) * (maxY - minY);
      if (area > bestArea) {
        bestArea = area;
        best = [(minX + maxX) / 2, (minY + maxY) / 2];
      }
    };
    if (g.type === "Polygon") consider(g.coordinates[0]);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((poly) => consider(poly[0]));
    if (best) out.set(iso3, { name: p.ADMIN || p.NAME, lon: +best[0].toFixed(4), lat: +best[1].toFixed(4) });
  }
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** POST an Overpass QL query with retry/backoff. Returns elements[]. */
export async function overpass(query) {
  const ENDPOINT = "https://overpass-api.de/api/interpreter";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "worldview-osint/1.0 (infra layers)",
        },
        body: query,
      });
      if ([429, 503, 504].includes(res.status)) {
        console.error(`Overpass ${res.status} — backing off`);
        await sleep(12000);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()).elements || [];
    } catch (err) {
      console.error(`Overpass fetch failed (${err.message}) — retrying`);
      await sleep(8000);
    }
  }
  throw new Error("Overpass unreachable after retries");
}
