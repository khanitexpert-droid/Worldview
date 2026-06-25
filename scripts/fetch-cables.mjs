// Submarine communications cables — TeleGeography's open Submarine Cable Map
// API (GeoJSON). Routes are MultiLineStrings between landing points. Written to
// public/infra_cables.json as InfraLine[].
//   node scripts/fetch-cables.mjs
// Source: TeleGeography submarinecablemap.com (CC BY-NC-SA 3.0 — non-commercial).
import { writeFile } from "node:fs/promises";

const GEO = "https://www.submarinecablemap.com/api/v3/cable/cable-geo.json";

console.log("Downloading submarine cable routes…");
const res = await fetch(GEO, {
  headers: { "User-Agent": "worldview-osint/1.0 (cables layer)" },
});
if (!res.ok) throw new Error(`submarinecablemap ${res.status}`);
const fc = await res.json();

const out = [];
for (const f of fc.features || []) {
  const g = f.geometry;
  if (!g) continue;
  const p = f.properties || {};
  // normalize to an array of [ [lon,lat], … ] segments
  let paths = [];
  if (g.type === "MultiLineString") paths = g.coordinates;
  else if (g.type === "LineString") paths = [g.coordinates];
  paths = paths
    .map((seg) => seg.map(([lon, lat]) => [+lon.toFixed(4), +lat.toFixed(4)]))
    .filter((seg) => seg.length >= 2);
  if (!paths.length) continue;
  // representative midpoint: middle vertex of the longest segment
  const longest = paths.reduce((a, b) => (b.length > a.length ? b : a));
  const mid = longest[Math.floor(longest.length / 2)];
  out.push({
    id: p.id || f.id || p.name,
    name: p.name || "Submarine cable",
    lon: mid[0],
    lat: mid[1],
    paths,
    code: p.id || undefined,
    note: "Submarine fiber-optic cable system.",
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(
  new URL("../public/infra_cables.json", import.meta.url),
  JSON.stringify(out)
);
console.log(`TOTAL: ${out.length} cables -> public/infra_cables.json`);
