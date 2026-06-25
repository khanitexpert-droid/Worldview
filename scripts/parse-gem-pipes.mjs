// Parse the GEM pipeline GIS GeoJSON (gas + oil/NGL) into public/infra_pipelines.json
// as InfraLine[]. The raw files are ~140 MB and ~6k pipelines, so we:
//   - keep only operating + construction status,
//   - group segments by pipeline (ProjectID),
//   - drop short local stubs (< MIN_KM total),
//   - Douglas-Peucker-simplify each segment + cap vertices (small file, fast globe).
//   node --max-old-space-size=4096 scripts/parse-gem-pipes.mjs
// Source: Global Energy Monitor GGIT/GOIT (CC BY 4.0).
import { readFile, writeFile } from "node:fs/promises";

const dir = new URL("../gem-data/", import.meta.url);
const FILES = [
  { fn: "GEM-GGIT-Gas-Pipelines-2025-11.geojson", fuel: "Gas" },
  { fn: "GEM-GOIT-Oil-NGL-Pipelines-2026-06.geojson", fuel: "Oil" },
];
const KEEP = new Set(["operating", "construction"]);
const MIN_KM = 120; // drop pipelines shorter than this (local distribution stubs)
const EPS = 0.05; // ~5 km simplification tolerance (degrees)
const MAX_PTS = 80; // hard cap on vertices per merged pipeline path

const clean = (s) =>
  s == null ? null : String(s).replace(/\s*\[[^\]]*\]/g, "").split(";")[0].trim() || null;
const titleCase = (s) => (s == null ? null : String(s).replace(/\b\w/g, (c) => c.toUpperCase()));

// ---- Douglas-Peucker on [lon,lat] points ----
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const t = (dx * dx + dy * dy) || 1e-12;
    const u = ((px - ax) * dx + (py - ay) * dy) / t;
    const cx = ax + u * dx, cy = ay + u * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    const left = rdp(pts.slice(0, idx + 1), eps);
    const right = rdp(pts.slice(idx), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}
function decimate(pts, max) {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}
function round(pts) {
  return pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
}
function haversineKm(pts) {
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const [lo1, la1] = pts[i - 1], [lo2, la2] = pts[i];
    const dLa = ((la2 - la1) * Math.PI) / 180, dLo = ((lo2 - lo1) * Math.PI) / 180;
    const a = Math.sin(dLa / 2) ** 2 +
      Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
    km += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return km;
}

// flatten any geometry into an array of raw [lon,lat] polylines
function extractPaths(g) {
  if (!g) return [];
  if (g.type === "LineString") return [g.coordinates];
  if (g.type === "MultiLineString") return g.coordinates;
  if (g.type === "GeometryCollection") return (g.geometries || []).flatMap(extractPaths);
  return [];
}

const groups = new Map(); // ProjectID -> { ...attrs, paths:[], km }
for (const { fn, fuel } of FILES) {
  console.log("reading", fn, "…");
  const fc = JSON.parse(await readFile(new URL(fn, dir), "utf8"));
  for (const f of fc.features || []) {
    const p = f.properties || {};
    const status = String(p.Status || "").toLowerCase();
    if (!KEEP.has(status)) continue;
    const id = p.ProjectID || p.PipelineName;
    if (!id) continue;
    const subs = extractPaths(f.geometry).filter((s) => Array.isArray(s) && s.length >= 2);
    if (!subs.length) continue;
    // merge a feature's sub-lines into ONE polyline (they're pieces of the same
    // segment); collapses MultiLineString/GeometryCollection blow-up to 1 path.
    const merged = subs.flat();
    let g = groups.get(id);
    if (!g) {
      g = {
        id,
        name: p.PipelineName || "Pipeline",
        fuel: p.Fuel || fuel,
        status,
        operator: clean(p.Owner) || clean(p.Parent) || null,
        country: p.CountriesOrAreas || null,
        lenKm: parseFloat(p.LengthMergedKm || p.LengthKnownKm || p.LengthEstimateKm) || 0,
        paths: [],
        km: 0,
      };
      groups.set(id, g);
    }
    g.km += haversineKm(merged);
    g.paths.push({ pts: round(decimate(rdp(merged, EPS), MAX_PTS)), km: haversineKm(merged) });
  }
}

// cap paths per pipeline to the longest few segments (bounds total polylines)
const MAX_PATHS_PER_PIPE = 6;
for (const g of groups.values()) {
  g.paths.sort((a, b) => b.km - a.km);
  g.paths = g.paths.slice(0, MAX_PATHS_PER_PIPE).map((s) => s.pts);
}

const out = [];
for (const g of groups.values()) {
  const totalKm = g.lenKm || g.km;
  if (totalKm < MIN_KM) continue;
  const longest = g.paths.reduce((a, b) => (b.length > a.length ? b : a));
  const mid = longest[Math.floor(longest.length / 2)];
  out.push({
    id: `pl-${g.id}`,
    name: g.name,
    lon: mid[0],
    lat: mid[1],
    paths: g.paths,
    status: titleCase(g.status),
    operator: g.operator || undefined,
    length: totalKm ? `${Math.round(totalKm).toLocaleString()} km` : undefined,
    country: g.country || undefined,
    code: g.id,
    note: `${g.fuel} transmission pipeline.`,
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
const totalSegs = out.reduce((n, p) => n + p.paths.length, 0);
const totalPts = out.reduce((n, p) => n + p.paths.reduce((m, s) => m + s.length, 0), 0);
const json = JSON.stringify(out);
await writeFile(new URL("../public/infra_pipelines.json", import.meta.url), json);
console.log(`Pipelines: ${out.length} | segments: ${totalSegs} | vertices: ${totalPts} | ${(json.length / 1e6).toFixed(2)} MB -> public/infra_pipelines.json`);
