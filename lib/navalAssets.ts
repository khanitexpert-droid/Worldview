import type { NavyShip } from "./types";

// Curated notable military vessels — public class/role data (USN / Naval Vessel
// Register / navies' fact files) with APPROXIMATE last-reported positions (navies
// don't broadcast AIS, so these are reference positions, not live). `wiki` is the
// Wikipedia page title used to fetch a vessel photo in the detail card.
export const NAVAL_ASSETS: NavyShip[] = [
  {
    id: "cvn-78", name: "USS Gerald R. Ford (CVN-78)", hull: "CVN-78",
    shipClass: "Ford-class aircraft carrier", fleetGroup: "Carrier Strike Group",
    role: "Nuclear supercarrier — CSG flagship.", crew: "~4,500", displacement: "~100,000 t",
    embarked: ["F/A-18E/F Super Hornet", "F-35C Lightning II", "E-2D Hawkeye", "EA-18G Growler", "MH-60R/S"],
    operator: "USN", lon: 33.2, lat: 34.4, asOf: "2026-06-18", wiki: "USS Gerald R. Ford (CVN-78)",
  },
  {
    id: "cvn-69", name: "USS Dwight D. Eisenhower (CVN-69)", hull: "CVN-69",
    shipClass: "Nimitz-class aircraft carrier", fleetGroup: "Carrier Strike Group",
    role: "Nuclear supercarrier — sustained strike ops.", crew: "~5,000", displacement: "~100,000 t",
    embarked: ["F/A-18E/F Super Hornet", "E-2D Hawkeye", "EA-18G Growler", "MH-60R/S"],
    operator: "USN", lon: 40.5, lat: 17.8, asOf: "2026-06-17", wiki: "USS Dwight D. Eisenhower",
  },
  {
    id: "lha-7", name: "USS Tripoli (LHA-7)", hull: "LHA-7",
    shipClass: "America-class amphibious assault ship", fleetGroup: "Amphibious Ready Group",
    role: "Lightning carrier — F-35B-optimized big-deck amphib.", crew: "~1,200", displacement: "~44,000 t",
    embarked: ["F-35B Lightning II (up to 20)", "MV-22B Osprey", "AH-1Z Viper", "UH-1Y Venom", "CH-53E/K Super Stallion", "MH-60S"],
    operator: "USN", lon: 64.85, lat: 20.43, asOf: "2026-06-19", wiki: "USS Tripoli (LHA-7)",
  },
  {
    id: "ddg-112", name: "USS Michael Murphy (DDG-112)", hull: "DDG-112",
    shipClass: "Arleigh Burke-class destroyer", fleetGroup: "Escort",
    role: "Aegis BMD / strike escort — Tomahawk + SM-2/3/6.", crew: "~330", displacement: "~9,200 t",
    embarked: ["MH-60R Seahawk (1–2)"],
    operator: "USN", lon: 64.42, lat: 18.71, asOf: "2026-06-19", wiki: "USS Michael Murphy",
  },
  {
    id: "ddg-64", name: "USS Carney (DDG-64)", hull: "DDG-64",
    shipClass: "Arleigh Burke-class destroyer", fleetGroup: "Escort",
    role: "Air & missile defense — intercepted Houthi missiles/drones.", crew: "~330", displacement: "~9,000 t",
    embarked: ["MH-60R Seahawk"],
    operator: "USN", lon: 41.8, lat: 15.6, asOf: "2026-06-18", wiki: "USS Carney",
  },
  {
    id: "cvn-70", name: "USS Carl Vinson (CVN-70)", hull: "CVN-70",
    shipClass: "Nimitz-class aircraft carrier", fleetGroup: "Carrier Strike Group",
    role: "Nuclear supercarrier — Indo-Pacific presence.", crew: "~5,000", displacement: "~100,000 t",
    embarked: ["F-35C Lightning II", "F/A-18E/F Super Hornet", "E-2D Hawkeye", "MH-60R/S"],
    operator: "USN", lon: 115.5, lat: 12.5, asOf: "2026-06-16", wiki: "USS Carl Vinson",
  },
  {
    id: "r09", name: "HMS Prince of Wales (R09)", hull: "R09",
    shipClass: "Queen Elizabeth-class aircraft carrier", fleetGroup: "Carrier Strike Group",
    role: "STOVL carrier — UK Carrier Strike Group flagship.", crew: "~700", displacement: "~65,000 t",
    embarked: ["F-35B Lightning II", "Merlin HM2", "Wildcat HMA2"],
    operator: "Royal Navy", lon: 72.0, lat: 6.0, asOf: "2026-06-15", wiki: "HMS Prince of Wales (R09)",
  },
  {
    id: "r91", name: "Charles de Gaulle (R91)", hull: "R91",
    shipClass: "Charles de Gaulle-class aircraft carrier", fleetGroup: "Carrier Strike Group",
    role: "France's nuclear carrier — CSG flagship.", crew: "~1,900", displacement: "~42,000 t",
    embarked: ["Rafale M", "E-2C Hawkeye", "NH90 / Dauphin"],
    operator: "Marine Nationale", lon: 30.5, lat: 33.6, asOf: "2026-06-16", wiki: "French aircraft carrier Charles de Gaulle",
  },
  {
    id: "cv-16", name: "Liaoning (CV-16)", hull: "CV-16",
    shipClass: "Kuznetsov-class (Type 001) aircraft carrier", fleetGroup: "Carrier Group",
    role: "PLAN training/strike carrier — Western Pacific ops.", crew: "~2,000", displacement: "~60,000 t",
    embarked: ["J-15 Flying Shark", "Z-18 / Z-9 helicopters"],
    operator: "PLA Navy", lon: 125.5, lat: 22.5, asOf: "2026-06-14", wiki: "Chinese aircraft carrier Liaoning",
  },
];
