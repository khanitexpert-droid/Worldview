// GDP per capita (current US$) by country — World Bank open API, joined to
// country centroids from the bundled Natural Earth borders. Written to
// public/infra_gdp.json as GdpDatum[]. Aggregates (regions/income groups) are
// dropped by only keeping ISO-A3 codes that match a real country polygon.
//   node scripts/fetch-gdp.mjs
// Source: World Bank (indicator NY.GDP.PCAP.CD), Natural Earth (centroids).
import { writeFile } from "node:fs/promises";
import { countryCentroids } from "./_geo.mjs";

const API =
  "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&per_page=20000&mrnev=1";

console.log("Downloading World Bank GDP-per-capita…");
const res = await fetch(API, {
  headers: { "User-Agent": "worldview-osint/1.0 (gdp layer)" },
});
if (!res.ok) throw new Error(`World Bank ${res.status}`);
const json = await res.json();
const rows = Array.isArray(json) ? json[1] || [] : [];

const centroids = await countryCentroids();
const out = [];
for (const r of rows) {
  const iso3 = r.countryiso3code;
  if (!iso3 || r.value == null) continue;
  const c = centroids.get(iso3);
  if (!c) continue; // not a real country polygon (drops WB aggregates)
  out.push({
    id: iso3,
    name: c.name,
    lon: c.lon,
    lat: c.lat,
    value: Math.round(r.value),
    year: r.date ? +r.date : undefined,
  });
}

out.sort((a, b) => b.value - a.value);
await writeFile(
  new URL("../public/infra_gdp.json", import.meta.url),
  JSON.stringify(out)
);
console.log(`TOTAL: ${out.length} countries -> public/infra_gdp.json`);
