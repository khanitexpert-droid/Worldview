import { readFile } from "node:fs/promises";
const dir = new URL("../gem-data/", import.meta.url);
for (const fn of ["GEM-GGIT-Gas-Pipelines-2025-11.geojson", "GEM-GOIT-Oil-NGL-Pipelines-2026-06.geojson"]) {
  const fc = JSON.parse(await readFile(new URL(fn, dir), "utf8"));
  const feats = fc.features || [];
  console.log("\n========", fn);
  console.log("features:", feats.length);
  const geom = {}, status = {};
  let sampleProps = null;
  for (const f of feats) {
    geom[f.geometry?.type] = (geom[f.geometry?.type] || 0) + 1;
    const st = (f.properties?.Status || f.properties?.status || "?");
    status[st] = (status[st] || 0) + 1;
    if (!sampleProps && f.geometry) sampleProps = f.properties;
  }
  console.log("geometry types:", geom);
  console.log("status:", status);
  console.log("property keys:", Object.keys(sampleProps || {}));
  const s = feats.find((f) => f.geometry);
  console.log("sample name:", s?.properties?.PipelineName || s?.properties?.pipeline, "| coords len:", JSON.stringify(s?.geometry?.coordinates)?.length);
}
