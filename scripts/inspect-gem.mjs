import xlsx from "xlsx";
const dir = new URL("../gem-data/", import.meta.url);
const files = {
  LNG: "GEM-GGIT-LNG-Teminals-2025-09.xlsx",
  GasPipe: "GEM-GGIT-Gas-Pipelines-2025-11.xlsx",
  OilPipe: "GEM-GOIT-Oil-NGL-Pipelines-2026-06.xlsx",
  Fields: "Global-Oil-and-Gas-Extraction-Tracker-March-2026.xlsx",
  Nuclear: "Global-Nuclear-Power-Tracker-September-2025.xlsx",
};
for (const [key, fn] of Object.entries(files)) {
  const wb = xlsx.readFile(new URL(fn, dir), { sheetRows: 3 });
  console.log("\n========", key, "::", fn);
  console.log("sheets:", wb.SheetNames);
  // pick the sheet with the most columns in row 1 as the data sheet
  let best = null, bestCols = -1;
  for (const sn of wb.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false });
    const hdr = rows[0] || [];
    if (hdr.length > bestCols) { bestCols = hdr.length; best = { sn, rows }; }
  }
  if (best) {
    console.log("data sheet:", best.sn, "(", bestCols, "cols )");
    console.log("HEADERS:", JSON.stringify(best.rows[0]));
    console.log("SAMPLE :", JSON.stringify(best.rows[1]));
  }
}
