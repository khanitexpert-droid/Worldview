// Water Stress — WRI Aqueduct 4.0 baseline annual "overall water risk"
// (w_awr_def_tot) per HydroSHEDS L6 basin, queried from the Esri Living Atlas
// FeatureServer for the AOR, simplified, and written to public/waterstress.json
// as WaterRisk[]. Choropleth + // WATER RISK card.
//   node scripts/fetch-waterstress.mjs
// Source: WRI Aqueduct 4.0 (CC BY 4.0), via ArcGIS Living Atlas.
import { writeFile } from "node:fs/promises";

const LAYER =
  "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/aqueduct_water_risk/FeatureServer/1/query";
const BBOX = [28, 10, 70, 44]; // [W,S,E,N] — Egypt/Levant/Arabia/Iraq/Iran/Gulf + east
const PAGE = 750;
const EPS = 0.05; // ~5 km polygon simplification
const MAX_PTS = 40; // vertex cap per ring

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const t = dx * dx + dy * dy || 1e-12;
    const u = ((px - ax) * dx + (py - ay) * dy) / t;
    const cx = ax + u * dx, cy = ay + u * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  return [pts[0], pts[pts.length - 1]];
}
const decimate = (p, m) => (p.length <= m ? p : p.filter((_, i) => i % Math.ceil(p.length / m) === 0));
const simp = (ring) => {
  const r = decimate(rdp(ring, EPS), MAX_PTS).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
  return r.length >= 3 ? r : null;
};
const bboxCenter = (ring) => {
  let a = 180, b = 90, c = -180, d = -90;
  for (const [x, y] of ring) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [+((a + c) / 2).toFixed(4), +((b + d) / 2).toFixed(4)];
};

async function page(offset) {
  const p = new URLSearchParams({
    where: "w_awr_def_tot_score >= 0 AND w_awr_def_tot_score <= 5",
    geometry: BBOX.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "aq30_id,name_0,name_1,w_awr_def_tot_score,w_awr_def_tot_label",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "3",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: "geojson",
  });
  const res = await fetch(`${LAYER}?${p}`, { headers: { "User-Agent": "worldview-osint/1.0 (water stress)" } });
  if (!res.ok) throw new Error(`Aqueduct ${res.status}`);
  return res.json();
}

const out = [];
let offset = 0;
for (;;) {
  process.stdout.write(`\rfetching offset ${offset}…   `);
  const fc = await page(offset);
  const feats = fc.features || [];
  for (const f of feats) {
    const g = f.geometry, pr = f.properties || {};
    if (!g) continue;
    let rings = [];
    if (g.type === "Polygon") rings = g.coordinates;
    else if (g.type === "MultiPolygon") rings = g.coordinates.flat();
    const polygons = rings.map((r) => simp(r)).filter(Boolean);
    if (!polygons.length) continue;
    const longest = polygons.reduce((a, b) => (b.length > a.length ? b : a));
    const [lon, lat] = bboxCenter(longest);
    out.push({
      id: `ws${pr.aq30_id}`,
      name: pr.name_1 ? `${pr.name_1}, ${pr.name_0}` : pr.name_0 || "Basin",
      lon, lat,
      polygons,
      score: +(+pr.w_awr_def_tot_score).toFixed(2),
      label: pr.w_awr_def_tot_label || "—",
      country: pr.name_0 || undefined,
    });
  }
  if (feats.length < PAGE) break;
  offset += PAGE;
}

const json = JSON.stringify(out);
await writeFile(new URL("../public/waterstress.json", import.meta.url), json);
const verts = out.reduce((n, b) => n + b.polygons.reduce((m, r) => m + r.length, 0), 0);
console.log(`\nWater Stress: ${out.length} basins | ${verts} verts | ${(json.length / 1e6).toFixed(2)} MB -> public/waterstress.json`);
