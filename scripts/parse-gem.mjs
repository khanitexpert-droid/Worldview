// Parse the Global Energy Monitor spreadsheets dropped in gem-data/ into the
// INFRA datasets, replacing the curated seeds with GEM's fuller coverage:
//   LNG Terminals      -> public/infra_lng.json     (GGIT, full)
//   Oil & Gas Fields   -> public/infra_oilgas.json  (GOGET, full)
//   Nuclear Sites      -> public/infra_nuclear.json (curated OSINT + GEM power reactors)
// Pipelines are NOT handled here — their routes live in the GEM GIS zips, not the
// xlsx — so the curated pipeline routes are left in place.
//   node scripts/parse-gem.mjs
// Source: Global Energy Monitor (CC BY 4.0).
import xlsx from "xlsx";
import { readFile, writeFile } from "node:fs/promises";

const dir = new URL("../gem-data/", import.meta.url);
const pub = (f) => new URL("../public/" + f, import.meta.url);

const sheet = (file, name) => {
  const wb = xlsx.readFile(new URL(file, dir));
  const sn = name || wb.SheetNames[wb.SheetNames.length - 1];
  return xlsx.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
};
const num = (v) => (v == null || v === "" ? null : parseFloat(v));
const clean = (s) =>
  s == null ? null : String(s).replace(/\s*\[[^\]]*\]/g, "").split(";")[0].trim() || null;
const titleCase = (s) =>
  s == null ? null : String(s).replace(/\b\w/g, (c) => c.toUpperCase());
const KEEP = new Set(["operating", "construction", "in development", "proposed", "mothballed", "idle"]);

// ---------- LNG terminals (GGIT) ----------
function buildLng() {
  const rows = sheet("GEM-GGIT-LNG-Teminals-2025-09.xlsx", "LNG Terminals");
  const byId = new Map();
  for (const r of rows) {
    const lat = num(r.Latitude), lon = num(r.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const status = String(r.Status || "").toLowerCase();
    if (!KEEP.has(status)) continue;
    const id = r.ProjectID || `${r.TerminalName}`;
    const mtpa = num(r.CapacityinMtpa);
    const prev = byId.get(id);
    // prefer the row carrying a capacity figure
    if (prev && !(mtpa && !prev._mtpa)) continue;
    const io = String(r.FacilityType || r.ImportExportOnly || "").toLowerCase();
    byId.set(id, {
      id: `lng-${id}`,
      name: r.TerminalName,
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
      country: r["Country/Area"] || undefined,
      status: titleCase(status),
      operator: clean(r.Operator) || clean(r.Owner) || undefined,
      stype: io.includes("export") ? "Export Terminal" : io.includes("import") ? "Import Terminal" : "LNG Terminal",
      capacity: mtpa ? `${mtpa} Mtpa` : undefined,
      note: `LNG ${io.includes("export") ? "export" : "import"} terminal.`,
      _mtpa: mtpa,
    });
  }
  const out = [...byId.values()].map(({ _mtpa, ...x }) => x);
  out.sort((a, b) => (a.country || "ZZ").localeCompare(b.country || "ZZ") || a.name.localeCompare(b.name));
  return out;
}

// ---------- Oil & gas fields (GOGET) ----------
function buildOilGas() {
  const rows = sheet("Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx", "Project-level main data");
  const out = [];
  for (const r of rows) {
    const lat = num(r.Latitude), lon = num(r.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const status = String(r.Status || "").toLowerCase();
    if (status !== "operating" && status !== "in development" && status !== "construction") continue;
    const fuel = String(r["Fuel type"] || "").toLowerCase();
    const stype = fuel.includes("oil") && fuel.includes("gas") ? "Oil & Gas Field" : fuel.includes("gas") ? "Gas Field" : "Oil Field";
    out.push({
      id: `og-${r["Project ID"]}`,
      name: r["Project Name"],
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
      country: r["Country/Area"] || undefined,
      status: titleCase(status),
      operator: clean(r.Operator) || clean(r["Owner(s)"]) || undefined,
      stype,
      note: r.Basin ? `${r["Production Type"] || ""} field · ${r.Basin} basin`.trim() : undefined,
    });
  }
  out.sort((a, b) => (a.country || "ZZ").localeCompare(b.country || "ZZ") || a.name.localeCompare(b.name));
  return out;
}

// ---------- Nuclear: keep curated OSINT (id "nuc-") + add GEM power reactors ----------
async function buildNuclear() {
  const curated = JSON.parse(await readFile(pub("infra_nuclear.json"), "utf8")).filter((x) => String(x.id).startsWith("nuc-"));
  const rows = sheet("Global-Nuclear-Power-Tracker-September-2025.xlsx", "Data");
  // aggregate units -> plants by GEM location ID
  const plants = new Map();
  for (const r of rows) {
    const lat = num(r.Latitude), lon = num(r.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const status = String(r.Status || "").toLowerCase();
    if (status !== "operating" && status !== "construction") continue;
    const id = r["GEM location ID"] || r["Project Name"];
    const cap = num(r["Capacity (MW)"]) || 0;
    const p = plants.get(id);
    if (p) { p.cap += cap; p.units++; }
    else plants.set(id, {
      id: `gnpt-${id}`, name: r["Project Name"], lat, lon,
      country: r["Country/Area"], status: titleCase(status),
      operator: clean(r.Operator), rtype: r["Reactor Type"], cap, units: 1,
    });
  }
  // drop GEM plants within ~0.3° of a curated site (avoid Bushehr/Barakah/etc. dupes)
  const near = (a, b) => Math.abs(a.lat - b.lat) < 0.3 && Math.abs(a.lon - b.lon) < 0.3;
  const gem = [...plants.values()]
    .filter((g) => !curated.some((c) => near(g, c)))
    .map((g) => ({
      id: g.id, name: g.name, lat: +g.lat.toFixed(5), lon: +g.lon.toFixed(5),
      country: g.country || undefined, status: g.status, stype: "power",
      capacity: g.cap ? `${Math.round(g.cap).toLocaleString()} MW` : undefined,
      operator: g.operator || undefined,
      note: `${g.units} reactor${g.units === 1 ? "" : "s"}${g.rtype ? " · " + g.rtype : ""}.`,
    }));
  const out = [...curated, ...gem];
  out.sort((a, b) => (a.country || "ZZ").localeCompare(b.country || "ZZ") || a.name.localeCompare(b.name));
  return { out, curatedN: curated.length, gemN: gem.length };
}

// ---------- run ----------
const lng = buildLng();
await writeFile(pub("infra_lng.json"), JSON.stringify(lng));
console.log(`LNG terminals: ${lng.length} -> public/infra_lng.json`);

const og = buildOilGas();
await writeFile(pub("infra_oilgas.json"), JSON.stringify(og));
console.log(`Oil & gas fields: ${og.length} -> public/infra_oilgas.json`);

const nuc = await buildNuclear();
await writeFile(pub("infra_nuclear.json"), JSON.stringify(nuc.out));
console.log(`Nuclear: ${nuc.out.length} (${nuc.curatedN} curated + ${nuc.gemN} GEM power) -> public/infra_nuclear.json`);
