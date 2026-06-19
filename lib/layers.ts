import type { LayerId } from "./types";

export interface LayerMeta {
  id: LayerId;
  label: string;
  short: string;
  icon: string;
  color: string; // css var hex used for HUD chips
  source: string;
  info: string; // hover blurb / fun fact shown in the Data Layers panel
  defaultOn: boolean;
}

// Central registry — the HUD, the boot sequence and the renderers all read this.
export const LAYERS: LayerMeta[] = [
  {
    id: "flights",
    label: "LIVE FLIGHTS",
    short: "ACFT",
    icon: "✈",
    color: "#ff2d95",
    source: "ADS-B NETWORK",
    info: "At any given moment roughly 8,000–20,000 aircraft are airborne worldwide — and more than 100,000 flights take off every single day.",
    defaultOn: true,
  },
  {
    id: "ships",
    label: "NAVAL / AIS",
    short: "AIS",
    icon: "⚓",
    color: "#00e5ff",
    source: "AIS RELAY (SIM)",
    info: "Over 50,000 large merchant ships are at sea right now, carrying around 90% of everything the world trades.",
    defaultOn: true,
  },
  {
    id: "satellites",
    label: "SATELLITES",
    short: "SATS",
    icon: "🛰",
    color: "#b14bff",
    source: "CELESTRAK · LEO+GEO",
    info: "LEO · Low Earth Orbit (under 2,000 km): the crowded zone where Starlink, the ISS and imaging sats lap the planet about every 90 minutes. GEO · Geostationary (~35,786 km): parked over the equator at Earth's spin speed, so each one hovers above a single spot — TV, weather and comms.",
    defaultOn: true,
  },
  {
    id: "earthquakes",
    label: "SEISMIC",
    short: "SEIS",
    icon: "◉",
    color: "#ffb347",
    source: "USGS FEED",
    info: "About 500,000 earthquakes are detected around the world each year — roughly 100,000 are felt, and around 100 cause damage.",
    defaultOn: true,
  },
  {
    id: "events",
    label: "WORLD EVENTS",
    short: "INTL",
    icon: "⚑",
    color: "#ffe14d",
    source: "GDELT · GLOBAL NEWS",
    info: "GDELT scans the world's news in 100+ languages and refreshes every 15 minutes. This layer clusters the day's conflict, unrest and disaster coverage by the country of the reporting outlets — the brighter the node, the more the world is reporting from there right now. Click a node for the latest headlines.",
    defaultOn: true,
  },
  {
    id: "cctv",
    label: "CCTV FEEDS",
    short: "CCTV",
    icon: "▣",
    color: "#ff414e",
    source: "PUBLIC CAMS (SIM)",
    info: "An estimated 1 billion surveillance cameras watch the world — about one camera for every 8 people alive.",
    defaultOn: false,
  },
  {
    id: "traffic",
    label: "STREET TRAFFIC",
    short: "TRFC",
    icon: "▤",
    color: "#5dff9e",
    source: "ROAD SENSORS (SIM)",
    info: "Earth's roads stretch about 64 million km end to end — enough to wrap around the planet more than 1,600 times.",
    defaultOn: false,
  },
];

export const LAYER_BY_ID: Record<LayerId, LayerMeta> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l])
) as Record<LayerId, LayerMeta>;
