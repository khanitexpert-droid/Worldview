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
  heading: number; // degrees
  velocity: number; // m/s
  country: string;
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
