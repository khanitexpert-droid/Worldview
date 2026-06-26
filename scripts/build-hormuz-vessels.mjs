// Build Strait of Hormuz · Crossings vessels (public/hormuz_vessels.json) — a
// fabricated-but-realistic fleet scattered along the real Gulf → Strait → Gulf
// of Oman → Arabian Sea shipping lanes (the live AIS relay is unreliable, and
// the user opted for deltasweep-style fabricated crossings). Deterministic
// (seeded), so re-runs are stable.  node scripts/build-hormuz-vessels.mjs
import { writeFile } from "node:fs/promises";

const TOTAL = 623, SANCTIONED = 90, AIS_GAP = 51, INBOUND = 256; // match deltasweep panel

let seed = 1337;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const jit = (v, d) => +(v + (rnd() * 2 - 1) * d).toFixed(4);
const int = (n) => Math.floor(rnd() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// anchorages / lane nodes (lon, lat, spread, weight)
const HUBS = [
  [48.0, 29.4, 0.5, 6], [50.4, 26.4, 0.5, 4], [51.5, 25.0, 0.4, 3],
  [54.6, 25.2, 0.5, 9], [56.4, 26.5, 0.4, 7], [56.4, 25.2, 0.5, 10],
  [56.2, 27.1, 0.4, 5], [58.6, 23.6, 0.5, 4], [60.5, 24.5, 0.9, 5],
  [64.0, 22.5, 1.3, 6], [66.5, 23.5, 0.9, 4], [67.0, 20.5, 1.3, 5],
];
const HUB_BAG = HUBS.flatMap((h, i) => Array(h[3]).fill(i));

const PRE = ["PACIFIC", "NORDIC", "GULF", "OCEAN", "STAR", "DESERT", "CRYSTAL", "SILVER", "GOLDEN", "ATLANTIC", "ASIAN", "EVER", "FRONT", "NEW", "SEA", "BW", "AL", "GLOBAL", "ROYAL", "BLUE", "GRAND", "NEPTUNE", "ORIENT", "HORIZON"];
const NAM = ["GLORY", "PIONEER", "VICTORY", "SPIRIT", "TRADER", "VOYAGER", "PEARL", "FALCON", "PHOENIX", "SATURN", "BATEEN", "MARROUNA", "SALAM", "NARAE", "STELLA", "OPAL", "HALTI", "BONITA", "TITAN", "ARROW", "CASTLE", "BREEZE", "DREAM", "EAGLE", "MARINER", "LEGEND", "PROGRESS", "HARMONY", "FORTUNE", "DUKE", "QUEEN", "SUN", "MOON", "DELTA", "SUMMIT", "BEACON", "COMET", "SATURN", "ZENITH", "ORCA"];
const FLAGS = ["Liberia", "Panama", "Marshall Islands", "Bahamas", "Singapore", "Malta", "Hong Kong", "Greece", "Cyprus", "China", "India", "United Arab Emirates", "Saudi Arabia", "South Korea", "Japan", "Norway", "Antigua and Barbuda"];
const SANCT_FLAGS = ["Iran", "Russia"];
const PORTS_IN = ["JEBEL ALI", "HAMAD", "DAMMAM", "KUWAIT", "UMM QASR IRAQ", "BANDAR ABBAS", "RAS TANURA", "DOHA", "BAHRAIN"];
const PORTS_OUT = ["SGSIN", "ROTTERDAM", "SUEZ", "MUMBAI", "KARACHI", "COLOMBO", "CHITTAGONG", "FUJAIRAH", "MUSCAT", "AWAITING ORDERS"];

const idxs = shuffle([...Array(TOTAL).keys()]);
const sanctSet = new Set(idxs.slice(0, SANCTIONED));
const gapSet = new Set(idxs.slice(SANCTIONED, SANCTIONED + AIS_GAP));
const dirArr = shuffle([...Array(INBOUND).fill("in"), ...Array(TOTAL - INBOUND).fill("out")]);

const out = [];
for (let i = 0; i < TOTAL; i++) {
  const h = HUBS[HUB_BAG[int(HUB_BAG.length)]];
  const lon = jit(h[0], h[2]);
  const lat = jit(h[1], h[2]);
  const sanctioned = sanctSet.has(i);
  const aisGap = gapSet.has(i);
  const direction = dirArr[i];
  const vtype = rnd() < 0.46 ? "TANKER" : "CARGO";
  const flag = sanctioned ? pick(SANCT_FLAGS) : pick(FLAGS);
  const riskTier = sanctioned || vtype === "TANKER" || rnd() < 0.12 ? "High" : "Low";
  const course = direction === "in" ? jit(315, 25) : jit(135, 25);
  out.push({
    id: `hv${1000 + i}`,
    name: rnd() < 0.85 ? `${pick(PRE)} ${pick(NAM)}` : pick(NAM),
    lon, lat,
    vtype,
    flag,
    destination: direction === "in" ? pick(PORTS_IN) : pick(PORTS_OUT),
    asOf: Date.now() - int(6 * 3600 * 1000),
    imo: 9000000 + int(999999),
    mmsi: String(200000000 + int(599999999)),
    speed: +(rnd() * 15.5).toFixed(1),
    course: +((course + 360) % 360).toFixed(0),
    direction,
    riskTier,
    sanctioned,
    aisGap,
  });
}

await writeFile(new URL("../public/hormuz_vessels.json", import.meta.url), JSON.stringify(out));
const s = out.filter((x) => x.sanctioned).length, g = out.filter((x) => x.aisGap).length, inb = out.filter((x) => x.direction === "in").length;
console.log(`Hormuz vessels: ${out.length} | ${s} sanctioned · ${g} AIS gap · ${inb} in / ${out.length - inb} out`);
