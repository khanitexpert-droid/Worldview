import type {
  Camera,
  Earthquake,
  Flight,
  RoadTraffic,
  Ship,
  Satellite,
} from "./types";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const fetchFlights = () => getJSON<{ items: Flight[] }>("/api/flights");
export const fetchShips = () => getJSON<{ items: Ship[] }>("/api/ships");
export const fetchSatellites = () =>
  getJSON<{ items: Satellite[] }>("/api/satellites");
export const fetchEarthquakes = () =>
  getJSON<{ items: Earthquake[] }>("/api/earthquakes");
export const fetchCctv = () => getJSON<{ items: Camera[] }>("/api/cctv");
export const fetchTraffic = () =>
  getJSON<{ items: RoadTraffic[] }>("/api/traffic");
