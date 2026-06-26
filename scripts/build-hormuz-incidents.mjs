// Build Strait of Hormuz · Incidents (public/hormuz_incidents.json) — a curated
// set of recent maritime incidents in/around the Strait & Gulf of Oman.
//   node scripts/build-hormuz-incidents.mjs
import { writeFile } from "node:fs/promises";

const wikiIran = "https://en.wikipedia.org/wiki/2026_Iran_war";
const cnn0525 = "https://www.cnn.com/2026/05/25/world/live-news/iran-war-us-peace-deal";
const redsea = "https://en.wikipedia.org/wiki/Red_Sea_crisis";

// {id,name,lat,lon,date,itype,severity,actors,location,source,url,note}
const I = [
  { id: "hi-vessel-oman", name: "Cargo vessel struck by projectile near Oman", lat: 24.5, lon: 57.7, date: "2026-06-25", itype: "Attack", severity: "CRITICAL", actors: "Iran (suspected)", location: "Gulf of Oman", source: "Wikipedia", url: wikiIran, note: "Vessel hit on a UN-approved route; the IMO paused its Strait of Hormuz evacuation plan." },
  { id: "hi-irgc-seizure", name: "IRGC seizes tanker near Larak Island", lat: 26.85, lon: 56.35, date: "2026-06-24", itype: "Seizure", severity: "HIGH", actors: "IRGC Navy", location: "Strait of Hormuz", source: "Wikipedia", url: wikiIran, note: "Fast boats boarded and diverted a tanker toward Bandar Abbas." },
  { id: "hi-fastboat", name: "IRGC fast-boat harassment of shipping", lat: 26.55, lon: 56.5, date: "2026-06-23", itype: "Harassment", severity: "MEDIUM", actors: "IRGC", location: "Strait of Hormuz", source: "Wikipedia", url: wikiIran, note: "Swarm of fast attack craft shadowed transiting vessels." },
  { id: "hi-us-boats", name: "US strikes Iranian fast boats near Hormuz", lat: 27.18, lon: 56.28, date: "2026-05-25", itype: "Kinetic Strike", severity: "HIGH", actors: "US Navy, Iran", location: "Bandar Abbas approaches", source: "CNN", url: cnn0525, note: "US 'self-defense' strikes on launchers and boats." },
  { id: "hi-drone-tanker", name: "Drone strike on tanker in the Gulf of Oman", lat: 24.9, lon: 57.4, date: "2026-06-20", itype: "Drone Strike", severity: "HIGH", actors: "Unattributed", location: "Gulf of Oman", source: "Wikipedia", url: wikiIran, note: "One-way attack drone struck a laden tanker; fire contained." },
  { id: "hi-gps", name: "Widespread GPS spoofing off Bandar Abbas", lat: 27.1, lon: 56.2, date: "2026-06-18", itype: "Electronic Interference", severity: "MEDIUM", actors: "Iran (suspected)", location: "Strait of Hormuz", source: "Wikipedia", url: wikiIran, note: "Vessels reported position jumps and AIS disruption." },
  { id: "hi-mine", name: "Suspected limpet-mine damage to hull", lat: 25.3, lon: 56.9, date: "2026-06-12", itype: "Sabotage", severity: "MEDIUM", actors: "Unattributed", location: "Gulf of Oman", source: "Wikipedia", url: wikiIran, note: "Vessel reported an explosion at the waterline; no casualties." },
  { id: "hi-aisdark", name: "Tanker goes AIS-dark near Qeshm", lat: 26.8, lon: 55.9, date: "2026-06-10", itype: "AIS Gap", severity: "LOW", actors: "Sanctioned operator", location: "Strait of Hormuz", source: "Wikipedia", url: wikiIran, note: "A sanctioned-flag tanker switched off its transponder mid-strait." },
  { id: "hi-redsea-link", name: "Houthi Red Sea ban raises Hormuz risk", lat: 26.4, lon: 56.6, date: "2026-06-08", itype: "Advisory", severity: "MEDIUM", actors: "Houthis", location: "Strait of Hormuz", source: "Wikipedia", url: redsea, note: "Spillover from the Red Sea crisis as insurers reprice Gulf transits." },
  { id: "hi-escort", name: "Naval escort convoy formed for tankers", lat: 25.9, lon: 56.7, date: "2026-06-05", itype: "Security Operation", severity: "LOW", actors: "Coalition navies", location: "Gulf of Oman", source: "Wikipedia", url: wikiIran, note: "Multinational escorts began shepherding merchant traffic." },
];

const out = I.map(({ date, ...r }) => ({ ...r, time: new Date(`${date}T12:00:00Z`).getTime() }))
  .sort((a, b) => b.time - a.time);
await writeFile(new URL("../public/hormuz_incidents.json", import.meta.url), JSON.stringify(out));
console.log(`Hormuz incidents: ${out.length} -> public/hormuz_incidents.json`);
