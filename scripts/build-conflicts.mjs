// Build WORLD EVENTS · World Conflicts (public/conflicts.json) — a curated
// overview of major ongoing armed conflicts worldwide, plotted at each
// conflict's centroid with a // CONFLICT card. Refresh by editing the list.
//   node scripts/build-conflicts.mjs
// Curated from public sources (Wikipedia "List of ongoing armed conflicts",
// ACLED, ICG) — a conflict overview, not a live event feed.
import { writeFile } from "node:fs/promises";

// [id, name, lat, lon, type, parties, since, intensity, note, country]
const C = [
  ["ukraine", "Russo-Ukrainian War", 49.0, 32.0, "War / interstate", "Russia vs. Ukraine", "2022", "High intensity", "The largest conventional land war in Europe since WWII.", "Ukraine"],
  ["iran-2026", "2026 Iran War", 32.0, 53.5, "War / interstate", "US & Israel vs. Iran", "2026", "Active", "US-Israeli strikes on Iran triggered a regional war; a fragile ceasefire holds since June 2026.", "Iran"],
  ["gaza", "Gaza War", 31.45, 34.4, "War", "Israel vs. Hamas", "2023", "Active", "War in the Gaza Strip since October 2023.", "Palestine"],
  ["lebanon", "Israel–Hezbollah", 33.6, 35.5, "War / interstate", "Israel vs. Hezbollah", "2023", "High intensity", "Cross-border fighting on the Israel–Lebanon front that escalated to the 2026 Lebanon war.", "Lebanon"],
  ["sudan", "Sudan Civil War", 15.5, 30.5, "Civil war", "SAF vs. RSF", "2023", "High intensity", "War between the Sudanese Armed Forces and the Rapid Support Forces, driving one of the world's worst displacement crises.", "Sudan"],
  ["myanmar", "Myanmar Civil War", 21.0, 96.0, "Civil war", "Junta vs. resistance & EAOs", "2021", "High intensity", "Nationwide armed resistance since the 2021 military coup.", "Myanmar"],
  ["yemen", "Yemeni Civil War", 15.5, 47.5, "Civil war", "Houthis vs. govt & coalition", "2014", "Active", "Protracted civil war; Houthis also strike Red Sea shipping and Israel.", "Yemen"],
  ["syria", "Syrian Conflict", 35.0, 38.5, "Insurgency", "Transitional govt vs. factions & ISIS", "2011", "Active", "Fragmented violence after the 2024 fall of the Assad regime.", "Syria"],
  ["mali", "Mali Insurgency", 17.5, -3.0, "Insurgency", "Junta & allies vs. JNIM / ISGS", "2012", "High intensity", "Jihadist insurgency across the central Sahel.", "Mali"],
  ["burkina", "Burkina Faso Insurgency", 12.3, -1.7, "Insurgency", "Junta vs. JNIM / ISGS", "2015", "High intensity", "One of the world's deadliest jihadist insurgencies.", "Burkina Faso"],
  ["niger", "Niger Insurgency", 16.5, 8.0, "Insurgency", "Junta vs. jihadist groups", "2015", "Active", "Sahel and Lake Chad-basin militancy.", "Niger"],
  ["drc", "Eastern DR Congo (M23)", -1.7, 28.9, "War", "DRC vs. M23 (Rwanda-backed)", "2022", "High intensity", "M23 offensive across North and South Kivu.", "DR Congo"],
  ["somalia", "Somali Civil War", 5.5, 46.5, "Insurgency", "Govt & AU vs. Al-Shabaab", "2009", "Active", "Long-running insurgency by al-Qaeda-aligned Al-Shabaab.", "Somalia"],
  ["nigeria", "Nigeria Insurgency", 11.5, 13.0, "Insurgency", "Nigeria vs. Boko Haram / ISWAP", "2009", "Active", "Jihadist insurgency in the north-east plus widespread banditry.", "Nigeria"],
  ["ethiopia", "Ethiopia Conflicts", 11.0, 38.5, "Insurgency", "Govt vs. Fano & OLA", "2023", "Active", "Insurgencies in the Amhara and Oromia regions.", "Ethiopia"],
  ["mexico", "Mexican Drug War", 23.5, -102.5, "Drug war", "Govt vs. cartels", "2006", "High intensity", "Sustained conflict between the state and powerful drug cartels.", "Mexico"],
  ["haiti", "Haiti Gang Conflict", 18.6, -72.3, "Gang war", "Govt & MSS vs. gang coalition", "2023", "High intensity", "Armed gangs control much of Port-au-Prince.", "Haiti"],
  ["mozambique", "Cabo Delgado Insurgency", -12.8, 40.3, "Insurgency", "Govt vs. ISIS-Mozambique", "2017", "Active", "Jihadist insurgency in northern Mozambique.", "Mozambique"],
  ["pakistan", "Pakistan Insurgencies", 30.0, 67.0, "Insurgency", "Pakistan vs. TTP & BLA", "2007", "Active", "Militancy by the Pakistani Taliban and Baloch separatists.", "Pakistan"],
  ["afghanistan", "Afghanistan (ISKP)", 34.5, 66.0, "Insurgency", "Taliban govt vs. ISKP & NRF", "2021", "Low intensity", "Insurgency against Taliban rule.", "Afghanistan"],
  ["colombia", "Colombian Conflict", 4.0, -73.5, "Insurgency", "Govt vs. ELN & FARC dissidents", "1964", "Active", "Decades-long conflict with remaining guerrilla and criminal groups.", "Colombia"],
  ["cameroon", "Anglophone Crisis", 6.0, 10.0, "Insurgency", "Govt vs. Ambazonia separatists", "2017", "Active", "Separatist conflict in Cameroon's English-speaking regions.", "Cameroon"],
  ["libya", "Libyan Crisis", 27.0, 17.0, "Civil war", "Rival governments & militias", "2014", "Low intensity", "Fragile standoff between rival administrations.", "Libya"],
  ["iraq", "Iraq (ISIS remnants)", 33.5, 43.7, "Insurgency", "Govt vs. ISIS remnants", "2013", "Low intensity", "Residual ISIS insurgency and militia activity.", "Iraq"],
  ["car", "Central African Republic", 6.6, 20.9, "Civil war", "Govt & allies vs. rebel coalition", "2012", "Active", "Long-running civil war with foreign security support.", "Central African Republic"],
  ["southsudan", "South Sudan Conflict", 7.5, 30.0, "Civil war", "Govt vs. opposition forces", "2013", "Active", "Recurring civil conflict and intercommunal violence.", "South Sudan"],
  ["india-naxal", "Naxalite Insurgency", 20.5, 81.5, "Insurgency", "India vs. Maoist Naxalites", "1967", "Low intensity", "Long-running Maoist insurgency in eastern India.", "India"],
  ["kashmir", "Kashmir Conflict", 34.0, 75.5, "Conflict / interstate", "India vs. Pakistan", "1947", "Low intensity", "Disputed region with periodic interstate flare-ups.", "India / Pakistan"],
  ["philippines", "Philippine Insurgencies", 7.5, 124.5, "Insurgency", "Govt vs. NPA & militants", "1969", "Low intensity", "Communist and Islamist insurgencies in Mindanao.", "Philippines"],
  ["sahara", "Western Sahara", 24.5, -13.5, "Conflict", "Morocco vs. Polisario Front", "1975", "Low intensity", "Frozen conflict reignited since 2020.", "Western Sahara"],
  ["caucasus", "Armenia–Azerbaijan", 39.8, 46.7, "Conflict / interstate", "Armenia vs. Azerbaijan", "2020", "Low intensity", "Tensions persist after the 2023 fall of Nagorno-Karabakh.", "Azerbaijan"],
  ["westbank", "Israel–West Bank", 32.0, 35.3, "Conflict", "Israel vs. Palestinian factions", "2023", "Active", "Escalating raids and clashes across the West Bank.", "Palestine"],
  ["turkey-pkk", "Turkey–PKK", 37.6, 42.0, "Insurgency", "Turkey vs. PKK", "1984", "Low intensity", "Decades-long insurgency now in a fragile peace process.", "Turkey"],
];

const out = C.map(([id, name, lat, lon, ctype, parties, since, intensity, note, country]) => ({
  id, name, lat, lon, ctype, parties, since, intensity, note, country,
}));
await writeFile(new URL("../public/conflicts.json", import.meta.url), JSON.stringify(out));
console.log(`World Conflicts: ${out.length} -> public/conflicts.json`);
