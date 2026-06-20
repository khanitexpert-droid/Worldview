// Fetch REAL military bases from OpenStreetMap (Overpass) across the MIDDLE EAST
// + ASIA theatre, and write a compact bundled dataset to
// public/military_bases.json. One regional query (no per-country rate-limit
// cascade), then each base is labelled with its country by point-in-polygon
// against the bundled Natural Earth borders (public/countries.geojson).
//
// Bases don't move, so this is a snapshot — re-run with
//   node scripts/fetch-military-bases.mjs
// Source: OpenStreetMap contributors (ODbL). Coverage = whatever's been mapped;
// well-known installations (incl. foreign/US bases hosted in the region) are
// generally present, but this is not an exhaustive order of battle.
import { writeFile, readFile } from "node:fs/promises";

// Middle East + Asia bounding box (south, west, north, east). Captures the Gulf,
// the Levant/Iraq/Iran, Central + South Asia, and East Asia (incl. Diego Garcia
// at ~-7, Japan/Korea), without dragging in the Americas/Europe.
const BBOX = [-11, 25, 53, 150];

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function query([s, w, n, e]) {
  // Explicitly-tagged, NAMED bases (base / naval base / air base). We do NOT add
  // landuse=military — even requiring a name, that pulls ~15k small obscure
  // military parcels across Asia (noise + far too many to render).
  const b = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:300];
(
  nwr["military"="base"]["name"]${b};
  nwr["military"="naval_base"]["name"]${b};
  nwr["military"="airfield"]["name"]${b};
);
out center tags;`;
}

function kindOf(t) {
  if (t.military === "naval_base") return "NAVAL";
  if (t.military === "airfield") return "AIR";
  return "BASE";
}

async function fetchBases() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "worldview-osint/1.0 (military bases layer)",
        },
        body: query(BBOX),
      });
      if ([429, 503, 504].includes(res.status)) {
        console.error(`Overpass ${res.status} — backing off`);
        await sleep(12000);
        continue;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      const j = await res.json();
      return j.elements || [];
    } catch (err) {
      console.error(`fetch failed (${err.message}) — retrying`);
      await sleep(8000);
    }
  }
  throw new Error("Overpass unreachable after retries");
}

// ---- point-in-polygon country labelling from the bundled borders ----
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
  // poly = [outerRing, ...holes]
  if (!ringContains(poly[0], x, y)) return false;
  for (let h = 1; h < poly.length; h++) if (ringContains(poly[h], x, y)) return false;
  return true;
}
async function buildCountryLookup() {
  const geo = JSON.parse(
    await readFile(new URL("../public/countries.geojson", import.meta.url), "utf8")
  );
  const polys = []; // { name, bbox:[minX,minY,maxX,maxY], poly }
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

// ---- run ----
console.log(`Querying Overpass for military bases in [${BBOX}]…`);
const els = await fetchBases();
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
  // dedupe near-duplicate node/way versions of the same base: same name within
  // ~1 km collapses to one.
  const key = `${t.name.toLowerCase().trim()}:${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({
    id: `${e.type[0]}${e.id}`,
    name: t.name,
    lon: +lon.toFixed(5),
    lat: +lat.toFixed(5),
    branch: kindOf(t),
    country: countryAt(lon, lat) || undefined,
    operator: t.operator || undefined,
  });
}

out.sort(
  (a, b) =>
    (a.country || "ZZ").localeCompare(b.country || "ZZ") ||
    a.name.localeCompare(b.name)
);

// quick per-country tally for the log
const tally = {};
for (const b of out) tally[b.country || "(unknown)"] = (tally[b.country || "(unknown)"] || 0) + 1;

await writeFile(
  new URL("../public/military_bases.json", import.meta.url),
  JSON.stringify(out)
);
console.log(`\nTOTAL: ${out.length} bases -> public/military_bases.json`);
console.log("by country:", tally);
