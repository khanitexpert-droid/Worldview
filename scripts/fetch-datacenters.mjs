// Data centers worldwide — OpenStreetMap (Overpass). Only NAMED features tagged
// as data centers (telecom/man_made/building=data_center) to cut noise. Country
// is labelled by point-in-polygon against the bundled borders. Written to
// public/infra_datacenters.json as InfraSite[].
//   node scripts/fetch-datacenters.mjs
// Source: OpenStreetMap contributors (ODbL). Coverage = whatever's been mapped.
import { writeFile } from "node:fs/promises";
import { overpass, buildCountryLookup } from "./_geo.mjs";

const QUERY = `[out:json][timeout:300];
(
  nwr["telecom"="data_center"]["name"];
  nwr["man_made"="data_center"]["name"];
  nwr["building"="data_center"]["name"];
);
out center tags;`;

console.log("Querying Overpass for data centers…");
const els = await overpass(QUERY);
console.log(`Overpass returned ${els.length} elements; labelling countries…`);
const countryAt = await buildCountryLookup();

const out = [];
const seen = new Set();
for (const e of els) {
  const t = e.tags || {};
  if (!t.name) continue;
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") continue;
  const key = `${t.name.toLowerCase().trim()}:${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({
    id: `${e.type[0]}${e.id}`,
    name: t.name,
    lon: +lon.toFixed(5),
    lat: +lat.toFixed(5),
    country: countryAt(lon, lat) || undefined,
    operator: t.operator || undefined,
    stype: "Data Center",
    note: t["addr:city"] || undefined,
  });
}

out.sort((a, b) => (a.country || "ZZ").localeCompare(b.country || "ZZ") || a.name.localeCompare(b.name));
await writeFile(
  new URL("../public/infra_datacenters.json", import.meta.url),
  JSON.stringify(out)
);
console.log(`TOTAL: ${out.length} data centers -> public/infra_datacenters.json`);
