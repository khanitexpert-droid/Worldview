// Fetch REAL airports from OurAirports (public domain) and write a compact
// bundled dataset to public/infra_airports.json. We keep only the major field:
// every large_airport, plus medium_airports that have scheduled service and an
// IATA code — i.e. airports a traveller could actually fly through. The ~80k
// small/heliport/closed entries are dropped (noise on a globe).
//
// Airports don't move, so this is a snapshot — re-run with
//   node scripts/fetch-airports.mjs
// Source: OurAirports (https://ourairports.com/data/) — public domain.
import { writeFile, readFile } from "node:fs/promises";

const CSV = "https://davidmegginson.github.io/ourairports-data/airports.csv";

// minimal RFC-4180 CSV parser (handles quoted fields w/ commas + "" escapes)
function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function iso2ToName() {
  const geo = JSON.parse(
    await readFile(new URL("../public/countries.geojson", import.meta.url), "utf8")
  );
  const map = new Map();
  for (const f of geo.features || []) {
    const p = f.properties || {};
    if (p.ISO_A2 && p.ISO_A2 !== "-99") map.set(p.ISO_A2, p.ADMIN || p.NAME);
  }
  return map;
}

console.log("Downloading OurAirports CSV…");
const res = await fetch(CSV, {
  headers: { "User-Agent": "worldview-osint/1.0 (airports layer)" },
});
if (!res.ok) throw new Error(`OurAirports ${res.status}`);
const rows = parseCSV(await res.text());
const header = rows[0];
const col = Object.fromEntries(header.map((h, i) => [h, i]));

const nameOf = await iso2ToName();
const out = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length < header.length) continue;
  const type = row[col.type];
  const sched = row[col.scheduled_service];
  const iata = row[col.iata_code];
  const keep =
    type === "large_airport" ||
    (type === "medium_airport" && sched === "yes" && iata);
  if (!keep) continue;
  const lat = parseFloat(row[col.latitude_deg]);
  const lon = parseFloat(row[col.longitude_deg]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const iso2 = row[col.iso_country];
  out.push({
    id: `ap${row[col.id]}`,
    name: row[col.name],
    lon: +lon.toFixed(5),
    lat: +lat.toFixed(5),
    country: nameOf.get(iso2) || iso2 || undefined,
    stype: type === "large_airport" ? "Major Hub" : "Regional Airport",
    code: iata || row[col.gps_code] || undefined,
    note: row[col.municipality] || undefined,
  });
}

out.sort((a, b) => (a.country || "ZZ").localeCompare(b.country || "ZZ") || a.name.localeCompare(b.name));
await writeFile(
  new URL("../public/infra_airports.json", import.meta.url),
  JSON.stringify(out)
);
console.log(`TOTAL: ${out.length} airports -> public/infra_airports.json`);
