// Major rivers — Natural Earth (ne_10m_rivers_lake_centerlines), public domain.
// Written to public/rivers.json as InfraLine[] (paths + name for labels).
//   node scripts/fetch-rivers.mjs
// Source: Natural Earth via the nvkelso/natural-earth-vector GeoJSON mirror.
import { writeFile } from "node:fs/promises";

const URL_NE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson";

const round = (pts) => pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);

console.log("Downloading Natural Earth rivers…");
const res = await fetch(URL_NE, {
  headers: { "User-Agent": "worldview-osint/1.0 (rivers layer)" },
});
if (!res.ok) throw new Error(`Natural Earth rivers ${res.status}`);
const fc = await res.json();

const out = [];
for (const f of fc.features || []) {
  const g = f.geometry;
  if (!g) continue;
  const p = f.properties || {};
  const name = p.name_en || p.name || p.label || "";
  let paths = [];
  if (g.type === "LineString") paths = [g.coordinates];
  else if (g.type === "MultiLineString") paths = g.coordinates;
  paths = paths.map(round).filter((s) => s.length >= 2);
  if (!paths.length) continue;
  const longest = paths.reduce((a, b) => (b.length > a.length ? b : a));
  const mid = longest[Math.floor(longest.length / 2)];
  out.push({
    id: `riv${p.ne_id || `${name}-${mid[0]}_${mid[1]}`}`.replace(/\s+/g, "_"),
    name: name || "River",
    lon: mid[0],
    lat: mid[1],
    paths,
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
const json = JSON.stringify(out);
await writeFile(new URL("../public/rivers.json", import.meta.url), json);
console.log(`Rivers: ${out.length} | ${(json.length / 1e6).toFixed(2)} MB -> public/rivers.json`);
