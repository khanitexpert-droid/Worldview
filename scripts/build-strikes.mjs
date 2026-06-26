// Build the GROUND · Strikes dataset (public/strikes.json) from the LATEST
// reported strikes across the Iran / Israel / US / Gulf theatre. Per the user's
// rule, NOTHING older than ~2 months is kept: a hard CUTOFF_DAYS filter drops
// stale events at build time. Refresh by updating the list below from current
// reporting (Al Jazeera et al.) and re-running:
//   node scripts/build-strikes.mjs
// Sources are real news/encyclopedia URLs (VIEW SOURCE links).
import { writeFile } from "node:fs/promises";

const CUTOFF_DAYS = 60;

// real article / timeline URLs gathered from current reporting
const U = {
  aj0608: "https://www.aljazeera.com/news/2026/6/8/israel-and-iran-exchange-attacks-as-ceasefire-falters",
  aj0618: "https://www.aljazeera.com/news/2026/6/18/israeli-attacks-on-southern-lebanon-kill-three-despite-us-iran-deal",
  aj0620: "https://www.aljazeera.com/news/2026/6/20/us-envoy-headed-for-switzerland-israeli-strikes-on-lebanon-threaten-talks",
  cnn0525: "https://www.cnn.com/2026/05/25/world/live-news/iran-war-us-peace-deal",
  npr0607: "https://www.npr.org/2026/06/07/nx-s1-5849220/israel-lebanon-beirut-airstrike-ceasefire",
  alarabiyaSyria: "https://english.alarabiya.net/News/middle-east/2026/06/24/us-forces-killed-isis-leader-in-syria-airstrike-centcom-says",
  lwjHouthi: "https://www.longwarjournal.org/archives/2026/06/houthis-attack-israel-and-announce-ban-on-israeli-vessels-in-the-red-sea.php",
  wikiLeb: "https://en.wikipedia.org/wiki/Timeline_of_the_2026_Lebanon_war",
  wikiIran: "https://en.wikipedia.org/wiki/2026_Iran_war",
  wikiGaza: "https://en.wikipedia.org/wiki/Gaza_war",
};

const S = [
  { id: "2026-0525-us-hormuz", name: "US strikes Iranian missile sites and boats near Hormuz", lat: 27.18, lon: 56.28, date: "2026-05-25", stype: "Naval & Missile-Site Strike", actor: "United States", target: "missile sites / boats", confidence: "MEDIUM", country: "Iran", source: "CNN", url: U.cnn0525, note: "US 'self-defense' strikes on Iranian missile launchers and fast boats near the Strait of Hormuz." },
  { id: "2026-0608-iran-ramatdavid", name: "Iran fires ballistic missiles at Israel; Ramat David base hit", lat: 32.665, lon: 35.18, date: "2026-06-08", stype: "Ballistic Missile Strike", actor: "Iran", target: "military airbase", confidence: "HIGH", country: "Israel", source: "Al Jazeera", url: U.aj0608, note: "Iranian barrage as the ceasefire faltered; Ramat David Airbase was damaged." },
  { id: "2026-0608-isr-tehran", name: "Israel strikes military sites in Tehran", lat: 35.70, lon: 51.42, date: "2026-06-08", stype: "Airstrike", actor: "Israel", target: "military", fatalities: 2, confidence: "HIGH", country: "Iran", source: "Al Jazeera", url: U.aj0608, note: "Explosions reported in Tehran, Isfahan and Tabriz; two Iranian soldiers killed." },
  { id: "2026-0608-isr-isfahan", name: "Israel strikes Isfahan", lat: 32.65, lon: 51.67, date: "2026-06-08", stype: "Airstrike", actor: "Israel", target: "military", confidence: "MEDIUM", country: "Iran", source: "Al Jazeera", url: U.aj0608, note: "Part of the June 8 strikes after the ceasefire faltered." },
  { id: "2026-0608-isr-tabriz", name: "Israel strikes Tabriz", lat: 38.07, lon: 46.30, date: "2026-06-08", stype: "Airstrike", actor: "Israel", target: "military", confidence: "MEDIUM", country: "Iran", source: "Al Jazeera", url: U.aj0608, note: "Part of the June 8 strikes after the ceasefire faltered." },
  { id: "2026-0625-iran-vessel", name: "Iran attacks cargo vessel near Oman", lat: 24.5, lon: 57.7, date: "2026-06-25", stype: "Anti-ship Attack", actor: "Iran", target: "commercial shipping", confidence: "MEDIUM", country: "Gulf of Oman", source: "Wikipedia", url: U.wikiIran, note: "A cargo vessel was damaged by a projectile near Oman amid the Hormuz dispute." },
  { id: "2026-0619-us-syria-isis", name: "US airstrike kills ISIS leader in northwest Syria", lat: 36.05, lon: 36.55, date: "2026-06-19", stype: "Drone Strike", actor: "United States", target: "ISIS leadership", fatalities: 1, confidence: "HIGH", country: "Syria", source: "Al Arabiya", url: U.alarabiyaSyria, note: "CENTCOM strike killed senior ISIS figure Ali Husayn al-'Ulaywi." },
  { id: "2026-0619-isr-khanyounis", name: "Israeli strike kills Islamic Jihad commander in Khan Younis", lat: 31.34, lon: 34.30, date: "2026-06-19", stype: "Airstrike", actor: "Israel", target: "militant leadership", confidence: "MEDIUM", country: "Gaza", source: "Wikipedia", url: U.wikiGaza, note: "Strike on Khan Younis killed the commander of Islamic Jihad's Khan Younis Brigade." },
  { id: "2026-0504-isr-tyre", name: "Israeli strikes on Tyre district", lat: 33.27, lon: 35.20, date: "2026-05-04", stype: "Airstrike", actor: "Israel", target: "Hezbollah infrastructure", confidence: "MEDIUM", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "Strikes on Hezbollah infrastructure in the Tyre district." },
  { id: "2026-0506-isr-beirut", name: "Israeli strike kills Radwan commander in Beirut", lat: 33.86, lon: 35.50, date: "2026-05-06", stype: "Airstrike", actor: "Israel", target: "Hezbollah commander", fatalities: 1, confidence: "HIGH", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "Killed Radwan Force commander Ahmed Ghaleb Balout in Ghobeiry." },
  { id: "2026-0515-isr-civdef", name: "Israeli strike hits civil-defense center, south Lebanon", lat: 33.30, lon: 35.30, date: "2026-05-15", stype: "Airstrike", actor: "Israel", target: "civil defense", fatalities: 6, confidence: "MEDIUM", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "Six killed including three paramedics; 22 injured." },
  { id: "2026-0518-isr-baalbek", name: "Israeli strike near Baalbek kills PIJ commander", lat: 34.00, lon: 36.21, date: "2026-05-18", stype: "Airstrike", actor: "Israel", target: "militant leadership", fatalities: 2, confidence: "MEDIUM", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "Killed a Palestinian Islamic Jihad commander and his daughter." },
  { id: "2026-0529-isr-slebanon", name: "Israeli strikes across south Lebanon", lat: 33.30, lon: 35.25, date: "2026-05-29", stype: "Airstrike", actor: "Israel", target: "multiple sites", fatalities: 142, confidence: "HIGH", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "142 killed in 72 hours of widespread strikes." },
  { id: "2026-0607-isr-dahieh", name: "Israel strikes Beirut's southern suburbs", lat: 33.86, lon: 35.50, date: "2026-06-07", stype: "Airstrike", actor: "Israel", target: "Hezbollah", fatalities: 2, confidence: "HIGH", country: "Lebanon", source: "NPR", url: U.npr0607, note: "Retaliatory strike on the Dahieh; two killed, 11 wounded." },
  { id: "2026-0609-isr-tyre", name: "Israeli strikes on Tyre", lat: 33.27, lon: 35.20, date: "2026-06-09", stype: "Airstrike", actor: "Israel", target: "Hezbollah positions", fatalities: 8, confidence: "MEDIUM", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "Eight killed, 32 injured in strikes on Tyre." },
  { id: "2026-0610-isr-sidon", name: "Israeli strikes across southern Lebanon", lat: 33.56, lon: 35.37, date: "2026-06-10", stype: "Airstrike", actor: "Israel", target: "multiple sites", fatalities: 19, confidence: "MEDIUM", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "19 killed across Tyre, Sidon and nearby towns." },
  { id: "2026-0614-isr-daqduq", name: "Israeli strike kills senior Hezbollah commander Daqduq", lat: 33.30, lon: 35.30, date: "2026-06-14", stype: "Airstrike", actor: "Israel", target: "Hezbollah commander", fatalities: 1, confidence: "HIGH", country: "Lebanon", source: "Wikipedia", url: U.wikiLeb, note: "Killed senior commander Ali Musa Daqduq in south Lebanon." },
  { id: "2026-0618-isr-slebanon", name: "Israeli strikes kill dozens in southern Lebanon", lat: 33.27, lon: 35.20, date: "2026-06-18", stype: "Airstrike", actor: "Israel", target: "Hezbollah", fatalities: 47, confidence: "HIGH", country: "Lebanon", source: "Al Jazeera", url: U.aj0618, note: "At least 47 killed amid intense fighting despite the US-Iran deal." },
  { id: "2026-0620-isr-lebanon", name: "Israeli strikes kill dozens in Lebanon amid truce talks", lat: 33.30, lon: 35.30, date: "2026-06-20", stype: "Airstrike", actor: "Israel", target: "Hezbollah", fatalities: 83, confidence: "HIGH", country: "Lebanon", source: "Al Jazeera", url: U.aj0620, note: "Over 100 strikes on south Lebanon just after a renewed ceasefire was announced." },
  { id: "2026-0608-houthi-telaviv", name: "Houthi missile & drone barrage on Tel Aviv area", lat: 32.08, lon: 34.78, date: "2026-06-08", stype: "Missile & Drone Barrage", actor: "Houthis", target: "military / civilian", confidence: "MEDIUM", country: "Israel", source: "FDD's Long War Journal", url: U.lwjHouthi, note: "Houthis fired at the Tel Aviv area in coordination with Iran and Hezbollah." },
  { id: "2026-0609-houthi-eilat", name: "Houthi cruise missiles & drones target Eilat", lat: 29.55, lon: 34.95, date: "2026-06-09", stype: "Cruise Missile & Drone Strike", actor: "Houthis", target: "military sites", confidence: "MEDIUM", country: "Israel", source: "FDD's Long War Journal", url: U.lwjHouthi, note: "Houthis claimed strikes on Eilat; air defenses engaged." },
];

const cutoff = Date.now() - CUTOFF_DAYS * 86_400_000;
let dropped = 0;
const out = [];
for (const s of S) {
  const time = new Date(`${s.date}T12:00:00Z`).getTime();
  if (time < cutoff) { dropped++; continue; }
  const { date, ...rest } = s;
  out.push({ ...rest, time });
}
out.sort((a, b) => b.time - a.time); // most recent first
await writeFile(new URL("../public/strikes.json", import.meta.url), JSON.stringify(out));
console.log(`Strikes: ${out.length} kept, ${dropped} dropped (older than ${CUTOFF_DAYS}d) -> public/strikes.json`);
if (out.length) console.log(`newest: ${new Date(out[0].time).toISOString().slice(0,10)}  oldest: ${new Date(out[out.length-1].time).toISOString().slice(0,10)}`);
