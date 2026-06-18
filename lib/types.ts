// Shared types for WORLDVIEW data feeds.

export type LayerId =
  | "flights"
  | "satellites"
  | "earthquakes"
  | "ships"
  | "cctv"
  | "traffic";

export interface Flight {
  id: string;
  callsign: string;
  lon: number;
  lat: number;
  altitude: number; // meters
  heading: number; // degrees (true track)
  velocity: number; // m/s (ground speed)
  verticalRate: number; // m/s (+climb / -descent)
  onGround: boolean;
  country: string; // origin country (may be "" for ADS-B sources)
  timePosition: number; // epoch ms of this position fix (for accurate propagation)
  aircraftType?: string; // e.g. "AIRBUS A-320neo" / "A20N"
  registration?: string; // e.g. "G-UZHK"
}

export interface Satellite {
  id: string;
  name: string;
  lon: number;
  lat: number;
  altKm: number;
}

export interface Earthquake {
  id: string;
  place: string;
  mag: number;
  lon: number;
  lat: number;
  depth: number; // km
  time: number; // epoch ms
}

export interface Ship {
  id: string;
  name: string;
  lon: number;
  lat: number;
  heading: number;
  type: string;
  speed: number; // knots
}

export interface Camera {
  id: string;
  name: string;
  lon: number;
  lat: number;
  status: "ONLINE" | "OFFLINE";
}

export interface RoadTraffic {
  id: string;
  lon: number;
  lat: number;
  level: "FREE" | "MODERATE" | "HEAVY" | "JAM";
  road: string;
}

export type FeedEntity =
  | ({ kind: "flights" } & Flight)
  | ({ kind: "satellites" } & Satellite)
  | ({ kind: "earthquakes" } & Earthquake)
  | ({ kind: "ships" } & Ship)
  | ({ kind: "cctv" } & Camera)
  | ({ kind: "traffic" } & RoadTraffic);
