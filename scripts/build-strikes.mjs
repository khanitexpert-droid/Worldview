// Build the curated GROUND · Strikes dataset (public/strikes.json) from a
// hand-authored list of notable, well-documented strikes across the Iran /
// Israel / US / Gulf theatre (2024-2025). Real OSINT events; readable ISO dates
// are converted to epoch ms. Source links go to the event's Wikipedia article.
//   node scripts/build-strikes.mjs
import { writeFile } from "node:fs/promises";

const wp = (t) => `https://en.wikipedia.org/wiki/${t}`;
// [id, name, lat, lon, date, stype, actor, target, fatalities|null, confidence, country, wikiTitle, note]
const S = [
  ["damascus-consulate-2024", "Israeli strike on Iranian consulate, Damascus", 33.5102, 36.2913, "2024-04-01", "Airstrike", "Israel", "IRGC officers", 16, "HIGH", "Syria", "2024_Israeli_strike_on_the_Iranian_consulate_in_Damascus", "Killed senior IRGC Quds Force commanders; triggered Iran's April 2024 retaliation."],
  ["apr2024-iran-barrage", "Iran launches drone & missile barrage at Israel", 31.05, 35.01, "2024-04-14", "Drone & Missile Barrage", "Iran", "military", 0, "HIGH", "Israel", "April_2024_Iranian_strikes_against_Israel", "'True Promise' — ~300 drones and missiles launched at Israel; nearly all intercepted."],
  ["apr2024-isr-isfahan", "Israeli strike near Isfahan air base", 32.65, 51.67, "2024-04-19", "Airstrike", "Israel", "air defense", 0, "HIGH", "Iran", "April_2024_Iranian_strikes_against_Israel", "Limited retaliatory strike on an air-defense radar near Isfahan."],
  ["shukr-2024", "Israeli strike in Beirut kills Fuad Shukr", 33.86, 35.51, "2024-07-30", "Airstrike", "Israel", "Hezbollah leadership", 7, "HIGH", "Lebanon", "Assassination_of_Fuad_Shukr", "Targeted strike on a senior Hezbollah commander in the southern suburbs."],
  ["tlv-2024-07-houthi", "Houthi drone strike on Tel Aviv", 32.07, 34.77, "2024-07-19", "Drone Strike", "Houthis", "civilian", 1, "HIGH", "Israel", "July_2024_Tel_Aviv_drone_attack", "A long-range drone evaded defenses and struck central Tel Aviv."],
  ["hodeidah-2024-07", "Israel strikes Hodeidah port, Yemen", 14.80, 42.95, "2024-07-20", "Airstrike", "Israel", "port / fuel depot", 6, "HIGH", "Yemen", "Israeli_airstrikes_on_Yemen", "Retaliation for the Houthi drone strike on Tel Aviv."],
  ["pagers-2024", "Pager & device explosions across Lebanon", 33.89, 35.50, "2024-09-17", "Covert Attack", "Israel", "Hezbollah", 42, "MEDIUM", "Lebanon", "2024_Lebanon_electronic_device_attacks", "Thousands of Hezbollah pagers and radios detonated simultaneously."],
  ["nasrallah-2024", "Israeli airstrike kills Hassan Nasrallah, Beirut", 33.857, 35.495, "2024-09-27", "Airstrike", "Israel", "Hezbollah leadership", 6, "HIGH", "Lebanon", "Assassination_of_Hassan_Nasrallah", "Massive strike on Hezbollah's underground HQ in the Dahieh."],
  ["lebanon-ground-2024", "Israeli ground & air operations in south Lebanon", 33.27, 35.20, "2024-10-01", "Ground & Air Operation", "Israel", "Hezbollah", null, "HIGH", "Lebanon", "2024_Israeli_invasion_of_Lebanon", "Cross-border operation against Hezbollah positions."],
  ["oct2024-iran-barrage", "Iran fires ~180 ballistic missiles at Israel", 32.08, 34.78, "2024-10-01", "Ballistic Missile Strike", "Iran", "military", 1, "HIGH", "Israel", "October_2024_Iranian_strikes_against_Israel", "'True Promise 2' — barrage on Nevatim, Tel Nof and Mossad HQ; one killed in the West Bank."],
  ["oct2024-isr-iran", "Israel strikes Iranian military sites", 35.70, 51.42, "2024-10-26", "Airstrike", "Israel", "military / missile production", 5, "HIGH", "Iran", "October_2024_Israeli_strikes_on_Iran", "'Days of Repentance' — strikes on missile production and air-defense sites."],
  ["tower22-2024", "Drone attack on Tower 22 base, Jordan", 32.49, 38.20, "2024-01-28", "Drone Strike", "Iran-backed militia", "US military base", 3, "HIGH", "Jordan", "Tower_22_drone_attack", "Killed three US soldiers; prompted broad US retaliation."],
  ["us-iraqsyria-feb2024", "US retaliatory strikes in Iraq & Syria", 34.38, 41.00, "2024-02-02", "Airstrike", "United States", "militia sites", 16, "HIGH", "Iraq / Syria", "February_2024_United_States_airstrikes_in_Iraq_and_Syria", "85+ targets struck in response to the Tower 22 attack."],
  ["yem-2024-01-sanaa", "US–UK airstrikes on Houthi sites in Sanaa", 15.37, 44.19, "2024-01-12", "Airstrike", "United States / UK", "military", null, "HIGH", "Yemen", "January_2024_missile_strikes_in_Yemen", "First major Western strikes on Houthi launch and radar sites."],
  ["redsea-shipping-2024", "Houthi attacks on Red Sea shipping", 13.6, 42.8, "2024-01-15", "Anti-ship Missile / Drone", "Houthis", "commercial shipping", null, "MEDIUM", "Red Sea", "Red_Sea_crisis", "Sustained missile and drone attacks on vessels near the Bab-el-Mandeb."],
  ["yem-2025-roughrider", "US launches sustained strikes on the Houthis", 15.37, 44.19, "2025-03-15", "Airstrike", "United States", "military", null, "HIGH", "Yemen", "2025_United_States_attacks_in_Yemen", "Weeks-long air campaign against Houthi targets across Yemen."],
  ["bgn-2025-05-houthi", "Houthi missile hits near Ben Gurion Airport", 32.00, 34.87, "2025-05-04", "Ballistic Missile Strike", "Houthis", "airport", 6, "HIGH", "Israel", "2025_Ben_Gurion_Airport_missile_attack", "A ballistic missile evaded defenses and struck airport grounds."],
  ["jun2025-isr-natanz", "Israel strikes Natanz enrichment facility", 33.7225, 51.7269, "2025-06-13", "Nuclear Facility Strike", "Israel", "nuclear facility", null, "HIGH", "Iran", "Operation_Rising_Lion", "Opening strikes of the June 2025 war damaged the Natanz enrichment site."],
  ["jun2025-isr-tehran", "Israeli airstrikes across Tehran", 35.70, 51.42, "2025-06-13", "Airstrike", "Israel", "military / leadership", null, "HIGH", "Iran", "Operation_Rising_Lion", "Strikes killed senior IRGC commanders and nuclear scientists."],
  ["jun2025-isr-tabriz", "Israel strikes military sites in Tabriz", 38.07, 46.30, "2025-06-13", "Airstrike", "Israel", "military", null, "MEDIUM", "Iran", "Operation_Rising_Lion", "Air-defense and missile sites in the northwest hit."],
  ["jun2025-isr-isfahan", "Israel strikes Isfahan nuclear site", 32.57, 51.82, "2025-06-14", "Nuclear Facility Strike", "Israel", "nuclear facility", null, "HIGH", "Iran", "Operation_Rising_Lion", "Strikes on the Isfahan nuclear technology complex."],
  ["jun2025-isr-arak", "Israel strikes Arak heavy-water reactor", 34.37, 49.24, "2025-06-19", "Nuclear Facility Strike", "Israel", "nuclear facility", null, "HIGH", "Iran", "Operation_Rising_Lion", "The Khondab/Arak heavy-water reactor was targeted."],
  ["jun2025-iran-telaviv", "Iran missile barrage hits Tel Aviv", 32.08, 34.78, "2025-06-13", "Ballistic Missile Strike", "Iran", "civilian / military", null, "HIGH", "Israel", "Operation_Rising_Lion", "Iranian ballistic missiles struck the Tel Aviv area in retaliation."],
  ["jun2025-iran-haifa", "Iran missiles strike Haifa", 32.79, 34.99, "2025-06-15", "Ballistic Missile Strike", "Iran", "civilian / industrial", null, "HIGH", "Israel", "Operation_Rising_Lion", "Missiles hit the Haifa bay industrial area."],
  ["jun2025-iran-beersheba", "Iran missile hits near Soroka Hospital, Beersheba", 31.26, 34.80, "2025-06-19", "Ballistic Missile Strike", "Iran", "civilian", null, "HIGH", "Israel", "Operation_Rising_Lion", "A ballistic missile struck near the Soroka Medical Center."],
  ["jun2025-us-fordow", "US B-2 strike on Fordow enrichment plant", 34.8847, 50.9956, "2025-06-22", "Nuclear Facility Strike", "United States", "nuclear facility", null, "HIGH", "Iran", "Operation_Midnight_Hammer", "B-2 bombers dropped GBU-57 bunker-busters on the deeply buried Fordow site."],
  ["jun2025-us-natanz", "US strike on Natanz nuclear site", 33.7225, 51.7269, "2025-06-22", "Nuclear Facility Strike", "United States", "nuclear facility", null, "HIGH", "Iran", "Operation_Midnight_Hammer", "Part of the coordinated US strike on Iran's nuclear program."],
  ["jun2025-us-isfahan", "US cruise-missile strikes on Isfahan nuclear site", 32.57, 51.82, "2025-06-22", "Cruise Missile Strike", "United States", "nuclear facility", null, "HIGH", "Iran", "Operation_Midnight_Hammer", "Submarine-launched Tomahawks struck the Isfahan complex."],
  ["jun2025-iran-aludeid", "Iran strikes Al Udeid Air Base, Qatar", 25.117, 51.315, "2025-06-23", "Ballistic Missile Strike", "Iran", "US military base", 0, "HIGH", "Qatar", "Operation_Midnight_Hammer", "Iran fired missiles at the US base in Qatar; intercepted, no casualties."],
  ["syria-2025-isr", "Israeli strikes on military sites near Damascus", 33.51, 36.29, "2025-05-02", "Airstrike", "Israel", "military", null, "MEDIUM", "Syria", "Israeli_bombing_of_Syria", "Continued strikes on military infrastructure after the fall of Assad."],
  ["baghdad-2024-militia", "US drone strike kills militia commander in Baghdad", 33.31, 44.36, "2024-02-07", "Drone Strike", "United States", "militia leadership", 3, "HIGH", "Iraq", "February_2024_United_States_airstrikes_in_Iraq_and_Syria", "Targeted a Kata'ib Hezbollah commander in eastern Baghdad."],
];

const out = S.map(([id, name, lat, lon, date, stype, actor, target, fatalities, confidence, country, wiki, note]) => {
  const o = {
    id,
    name,
    lat,
    lon,
    time: new Date(`${date}T12:00:00Z`).getTime(),
    stype,
    actor,
    target,
    confidence,
    source: "Wikipedia",
    url: wp(wiki),
    country,
    note,
  };
  if (fatalities != null) o.fatalities = fatalities;
  return o;
});

out.sort((a, b) => b.time - a.time); // most recent first
await writeFile(new URL("../public/strikes.json", import.meta.url), JSON.stringify(out));
console.log(`Strikes: ${out.length} -> public/strikes.json`);
