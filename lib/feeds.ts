import type {
  Earthquake,
  Fire,
  Flight,
  MilitaryBase,
  Ship,
  SatelliteTle,
  WorldEvent,
  InfraSite,
  InfraLine,
  GdpDatum,
  StrikeEvent,
  WaterRisk,
  IntelEvent,
  Conflict,
  HormuzIncident,
  HormuzVuln,
} from "./types";

export interface SatellitesResponse {
  items: SatelliteTle[];
  source: string;
  live: boolean;
  fetchedAt: string;
  counts: { LEO: number; GEO: number; total: number };
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const fetchFlights = () =>
  getJSON<{ items: Flight[]; source: string; live: boolean }>("/api/flights");
export const fetchShips = () => getJSON<{ items: Ship[] }>("/api/ships");
export const fetchSatellites = () =>
  getJSON<SatellitesResponse>("/api/satellites");
export const fetchEarthquakes = () =>
  getJSON<{ items: Earthquake[] }>("/api/earthquakes");
// Active fires / thermal anomalies — NASA FIRMS (VIIRS), relayed server-side so
// the FIRMS map key is never exposed to the browser.
export const fetchFires = () =>
  getJSON<{ items: Fire[]; source?: string }>("/api/fires");
// Bundled static snapshot of real OSM military bases (they don't move, so we
// don't poll an API for them). Wrapped to match the generic feed shape.
export const fetchBases = async () => ({
  items: await getJSON<MilitaryBase[]>("/military_bases.json"),
  source: "OPENSTREETMAP",
});
// Curated military vessels (NAVY SHIPS) — a static reference set, not live AIS.
export const fetchNavyShips = async () => ({
  items: (await import("./navalAssets")).NAVAL_ASSETS,
  source: "CURATED · USN",
});
// Curated strike events (GROUND) — a bundled static snapshot (historical, not live).
export const fetchStrikes = async () => ({
  items: await getJSON<StrikeEvent[]>("/strikes.json"),
  source: "CURATED · OSINT",
});
// Read the events the scheduled GitHub Action publishes (relayed same-origin by
// /api/events). We do NOT fetch GDELT from the browser — its CORS on the JSON
// endpoint is unreliable and per-IP rate limits bite visitors.
export const fetchEvents = () =>
  getJSON<{ items: WorldEvent[]; source?: string }>("/api/events");

// ---- INFRA layers ----
// All INFRA datasets are bundled static snapshots in /public (sites/routes don't
// move), baked by the scripts/fetch-infra-*.mjs scripts. This loader is
// resilient: a layer whose data file hasn't been generated yet returns empty
// rather than throwing (so toggling it never crashes the globe).
async function staticInfra<T>(url: string, source: string) {
  try {
    return { items: await getJSON<T[]>(url), source };
  } catch {
    return { items: [] as T[], source };
  }
}
export const fetchLng = () => staticInfra<InfraSite>("/infra_lng.json", "OPENSTREETMAP");
export const fetchNuclear = () =>
  staticInfra<InfraSite>("/infra_nuclear.json", "CURATED · OSINT");
export const fetchOilGas = () =>
  staticInfra<InfraSite>("/infra_oilgas.json", "OPENSTREETMAP");
export const fetchRefineries = () =>
  staticInfra<InfraSite>("/infra_refineries.json", "OPENSTREETMAP");
export const fetchAirports = () =>
  staticInfra<InfraSite>("/infra_airports.json", "OURAIRPORTS");
export const fetchMinerals = () =>
  staticInfra<InfraSite>("/infra_minerals.json", "USGS / OSM");
export const fetchDataCenters = () =>
  staticInfra<InfraSite>("/infra_datacenters.json", "OPENSTREETMAP");
export const fetchDesal = () =>
  staticInfra<InfraSite>("/infra_desal.json", "OPENSTREETMAP");
export const fetchPorts = () => staticInfra<InfraSite>("/infra_ports.json", "NGA WPI");
export const fetchPipelines = () =>
  staticInfra<InfraLine>("/infra_pipelines.json", "GLOBAL ENERGY MONITOR");
export const fetchCables = () =>
  staticInfra<InfraLine>("/infra_cables.json", "TELEGEOGRAPHY");
export const fetchGdp = () => staticInfra<GdpDatum>("/infra_gdp.json", "WORLD BANK");

// ---- ENVIRO layers (bundled static; landcover is a raster imagery toggle) ----
export const fetchWaterStress = () =>
  staticInfra<WaterRisk>("/waterstress.json", "WRI AQUEDUCT 4.0");
export const fetchMajorRivers = () =>
  staticInfra<InfraLine>("/rivers.json", "NATURAL EARTH");

// ---- WORLD EVENTS layers (curated static snapshots) ----
export const fetchWorldEvents = () =>
  staticInfra<IntelEvent>("/world_events.json", "CURATED · OSINT");
export const fetchConflicts = () =>
  staticInfra<Conflict>("/conflicts.json", "CURATED · OSINT");
export const fetchHormuzIncidents = () =>
  staticInfra<HormuzIncident>("/hormuz_incidents.json", "CURATED · OSINT");
export const fetchHormuzVuln = () =>
  staticInfra<HormuzVuln>("/hormuz_vulnerability.json", "CURATED");
