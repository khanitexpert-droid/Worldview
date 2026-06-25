import { COUNTRY_CENTROIDS } from "./countryCentroids";

// Detect a location in a headline for the ACTIVITY feed (country / city / area
// level — not exact coords). Specific conflict places are checked before
// countries so e.g. "Strait of Hormuz" wins over "Iran". Word-START matching
// (\b prefix, no suffix) so "Iran" also catches "Iranian", while a start
// boundary keeps "Oman" out of "woman"/"Romania".

// Specific areas/cities, [lon, lat].
const PLACES: { name: string; token: string; coords: [number, number] }[] = [
  { name: "Strait of Hormuz", token: "strait of hormuz", coords: [56.4, 26.6] },
  { name: "Strait of Hormuz", token: "hormuz", coords: [56.4, 26.6] },
  { name: "Red Sea", token: "red sea", coords: [38.0, 20.0] },
  { name: "Gulf of Aden", token: "gulf of aden", coords: [47.0, 12.5] },
  { name: "Persian Gulf", token: "persian gulf", coords: [51.5, 27.0] },
  { name: "South China Sea", token: "south china sea", coords: [114.0, 13.0] },
  { name: "Taiwan Strait", token: "taiwan strait", coords: [119.5, 24.5] },
  { name: "Black Sea", token: "black sea", coords: [34.0, 43.5] },
  { name: "Gaza", token: "gaza", coords: [34.45, 31.5] },
  { name: "West Bank", token: "west bank", coords: [35.3, 32.0] },
  { name: "Rafah", token: "rafah", coords: [34.25, 31.29] },
  { name: "Golan Heights", token: "golan", coords: [35.75, 33.0] },
  { name: "Beirut", token: "beirut", coords: [35.5, 33.9] },
  { name: "Tehran", token: "tehran", coords: [51.4, 35.7] },
  { name: "Jerusalem", token: "jerusalem", coords: [35.2, 31.78] },
  { name: "Tel Aviv", token: "tel aviv", coords: [34.78, 32.08] },
  { name: "Damascus", token: "damascus", coords: [36.3, 33.5] },
  { name: "Baghdad", token: "baghdad", coords: [44.4, 33.3] },
  { name: "Sanaa", token: "sana", coords: [44.2, 15.35] },
  { name: "Moscow", token: "moscow", coords: [37.6, 55.75] },
  { name: "Kyiv", token: "kyiv", coords: [30.5, 50.45] },
  { name: "Kyiv", token: "kiev", coords: [30.5, 50.45] },
  { name: "Kharkiv", token: "kharkiv", coords: [36.25, 49.99] },
  { name: "Crimea", token: "crimea", coords: [34.0, 45.3] },
  { name: "Donbas", token: "donbas", coords: [37.8, 48.0] },
  { name: "Bakhmut", token: "bakhmut", coords: [38.0, 48.6] },
];

// extra tokens mapped to a canonical country (uses COUNTRY_CENTROIDS coords)
const COUNTRY_ALIASES: { name: string; token: string }[] = [
  { name: "Ukraine", token: "ukrain" }, // ukraine / ukrainian
  { name: "Yemen", token: "houthi" },
  { name: "United States", token: "washington" },
  { name: "United States", token: "pentagon" },
  { name: "United States", token: "american" },
  { name: "United Kingdom", token: "britain" },
  { name: "United Kingdom", token: "british" },
  { name: "United Kingdom", token: "london" },
];

// keep these 4-letter country names (otherwise short names are skipped to avoid
// false positives like Togo→"together")
const SHORT_OK = new Set(["Iran", "Iraq", "Oman", "Mali", "Chad"]);

type Entry = { name: string; coords: [number, number]; re: RegExp; len: number };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ENTRIES: Entry[] = [];
const add = (name: string, token: string, coords: [number, number]) =>
  ENTRIES.push({ name, coords, re: new RegExp("\\b" + esc(token), "i"), len: token.length });

for (const p of PLACES) add(p.name, p.token, p.coords);
for (const a of COUNTRY_ALIASES) {
  const c = COUNTRY_CENTROIDS[a.name];
  if (c) add(a.name, a.token, c);
}
for (const [name, coords] of Object.entries(COUNTRY_CENTROIDS)) {
  if (name.length < 5 && !SHORT_OK.has(name)) continue;
  add(name, name.toLowerCase(), coords);
}
// most specific (longest token) first
ENTRIES.sort((a, b) => b.len - a.len);

/** Detect a location in a headline, or null. */
export function geolocate(title: string): { name: string; lon: number; lat: number } | null {
  for (const e of ENTRIES) {
    if (e.re.test(title)) return { name: e.name, lon: e.coords[0], lat: e.coords[1] };
  }
  return null;
}
