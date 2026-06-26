// Build Strait of Hormuz · Vulnerability (public/hormuz_vulnerability.json) — a
// curated oil-supply-vulnerability typology per country, joined to country
// polygons (Natural Earth) for the choropleth + // HORMUZ VULNERABILITY card.
//   node scripts/build-hormuz-vuln.mjs
// Curated (approx. real figures): ME oil share, strategic reserve days,
// GDP/capita, oil consumption. Inspired by Hormuz-vulnerability cluster work.
import { readFile, writeFile } from "node:fs/promises";

// [iso3, class, meOilSharePct, reserveDays, gdpCapita, oilConsumptionKbd]
const V = [
  ["PAK", "Most vulnerable", 99.6, 0, 1479, 424],
  ["IND", "Most vulnerable", 60, 9, 2480, 5200],
  ["BGD", "Most vulnerable", 90, 0, 2680, 130],
  ["LKA", "Most vulnerable", 95, 0, 3830, 110],
  ["PHL", "Most vulnerable", 85, 0, 3870, 480],
  ["ZAF", "Most vulnerable", 50, 0, 6020, 600],
  ["KEN", "Most vulnerable", 90, 0, 2100, 110],
  ["ETH", "Most vulnerable", 95, 0, 1020, 80],
  ["EGY", "Vulnerable", 40, 0, 3540, 850],
  ["MAR", "Vulnerable", 70, 0, 3700, 300],
  ["THA", "Vulnerable", 60, 25, 7300, 1300],
  ["CHN", "Vulnerable", 45, 90, 12600, 15000],
  ["KOR", "Vulnerable", 70, 90, 33000, 2700],
  ["JPN", "Vulnerable", 90, 150, 33800, 3300],
  ["TWN", "Vulnerable", 80, 60, 33000, 1000],
  ["TUR", "Vulnerable", 50, 20, 10600, 1000],
  ["IDN", "Vulnerable", 40, 20, 4790, 1600],
  ["SGP", "Vulnerable", 80, 60, 84500, 1400],
  ["AUS", "Vulnerable", 30, 60, 64000, 1000],
  ["ESP", "Moderate", 25, 90, 30100, 1200],
  ["ITA", "Moderate", 25, 90, 35500, 1200],
  ["GRC", "Moderate", 35, 90, 20900, 300],
  ["POL", "Moderate", 15, 90, 18700, 600],
  ["DEU", "Moderate", 10, 90, 48700, 2000],
  ["FRA", "Moderate", 15, 90, 40900, 1500],
  ["GBR", "Moderate", 10, 90, 46100, 1200],
  ["NLD", "Moderate", 20, 90, 57000, 900],
  ["USA", "Low", 8, 600, 76300, 19000],
  ["BRA", "Low", 5, 30, 8900, 2400],
  ["RUS", "Low", 0, 0, 13000, 3600],
  ["SAU", "Low", 0, 0, 30400, 3800],
  ["ARE", "Low", 0, 0, 49500, 1000],
  ["NOR", "Low", 0, 90, 89000, 220],
  ["CAN", "Low", 0, 0, 53500, 2400],
];

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const dx = bx - ax, dy = by - ay, t = dx * dx + dy * dy || 1e-12;
    const u = ((px - ax) * dx + (py - ay) * dy) / t;
    const d = Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  return [pts[0], pts[pts.length - 1]];
}
const simp = (ring) => {
  const r = rdp(ring, 0.25).map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);
  return r.length >= 3 ? r : null;
};
const bboxCenter = (ring) => {
  let a = 180, b = 90, c = -180, d = -90;
  for (const [x, y] of ring) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [+((a + c) / 2).toFixed(3), +((b + d) / 2).toFixed(3)];
};

const geo = JSON.parse(await readFile(new URL("../public/countries.geojson", import.meta.url), "utf8"));
const byIso = new Map();
for (const f of geo.features || []) {
  const p = f.properties || {};
  const iso = p.ISO_A3 && p.ISO_A3 !== "-99" ? p.ISO_A3 : p.ADM0_A3;
  if (iso) byIso.set(iso, f);
}

const out = [];
for (const [iso, cls, meShare, reserve, gdp, oil] of V) {
  const f = byIso.get(iso);
  if (!f) { console.warn("no polygon for", iso); continue; }
  const g = f.geometry;
  let rings = [];
  if (g.type === "Polygon") rings = g.coordinates;
  else if (g.type === "MultiPolygon") rings = g.coordinates.flat();
  const polygons = rings.map((r) => simp(r)).filter(Boolean);
  if (!polygons.length) continue;
  const longest = polygons.reduce((a, b) => (b.length > a.length ? b : a));
  const [lon, lat] = bboxCenter(longest);
  out.push({
    id: iso,
    name: f.properties.ADMIN || f.properties.NAME,
    lon, lat, polygons,
    cls,
    meOilShare: `${meShare}%`,
    strategicReserve: `${reserve} days`,
    gdpCapita: gdp,
    oilConsumption: `${oil.toLocaleString()} kb/d`,
  });
}
const json = JSON.stringify(out);
await writeFile(new URL("../public/hormuz_vulnerability.json", import.meta.url), json);
console.log(`Hormuz vulnerability: ${out.length} countries | ${(json.length / 1e6).toFixed(2)} MB`);
