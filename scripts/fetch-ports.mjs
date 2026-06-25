// Major seaports — Natural Earth (ne_10m_ports), a clean public-domain set of
// ~1,100 significant ports worldwide. Country labelled by point-in-polygon.
// Written to public/infra_ports.json as InfraSite[].
//   node scripts/fetch-ports.mjs
// Source: Natural Earth (public domain), via the nvkelso/natural-earth-vector
// GeoJSON mirror.
import { writeFile } from "node:fs/promises";
import { buildCountryLookup } from "./_geo.mjs";

const URL_NE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_ports.geojson";

console.log("Downloading Natural Earth ports…");
const res = await fetch(URL_NE, {
  headers: { "User-Agent": "worldview-osint/1.0 (ports layer)" },
});
if (!res.ok) throw new Error(`Natural Earth ports ${res.status}`);
const fc = await res.json();
const countryAt = await buildCountryLookup();

const out = [];
for (const f of fc.features || []) {
  const g = f.geometry;
  if (!g || g.type !== "Point") continue;
  const [lon, lat] = g.coordinates;
  const p = f.properties || {};
  const name = p.name || p.NAME || p.portname;
  if (!name || typeof lon !== "number" || typeof lat !== "number") continue;
  out.push({
    id: `port${p.ne_id || p.scalerank + "_" + name}`.replace(/\s+/g, "_"),
    name,
    lon: +lon.toFixed(5),
    lat: +lat.toFixed(5),
    country: countryAt(lon, lat) || undefined,
    stype: "Seaport",
    note: p.website || undefined,
  });
}

out.sort((a, b) => (a.country || "ZZ").localeCompare(b.country || "ZZ") || a.name.localeCompare(b.name));
await writeFile(
  new URL("../public/infra_ports.json", import.meta.url),
  JSON.stringify(out)
);
console.log(`TOTAL: ${out.length} ports -> public/infra_ports.json`);
