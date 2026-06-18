import type { LayerId } from "./types";

export interface LayerMeta {
  id: LayerId;
  label: string;
  short: string;
  icon: string;
  color: string; // css var hex used for HUD chips
  source: string;
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
    defaultOn: true,
  },
  {
    id: "ships",
    label: "NAVAL / AIS",
    short: "AIS",
    icon: "⚓",
    color: "#00e5ff",
    source: "AIS RELAY (SIM)",
    defaultOn: true,
  },
  {
    id: "satellites",
    label: "SATELLITES",
    short: "SATS",
    icon: "🛰",
    color: "#b14bff",
    source: "CELESTRAK",
    defaultOn: true,
  },
  {
    id: "earthquakes",
    label: "SEISMIC",
    short: "SEIS",
    icon: "◉",
    color: "#ffb347",
    source: "USGS FEED",
    defaultOn: true,
  },
  {
    id: "cctv",
    label: "CCTV FEEDS",
    short: "CCTV",
    icon: "▣",
    color: "#ff414e",
    source: "PUBLIC CAMS (SIM)",
    defaultOn: false,
  },
  {
    id: "traffic",
    label: "STREET TRAFFIC",
    short: "TRFC",
    icon: "▤",
    color: "#5dff9e",
    source: "ROAD SENSORS (SIM)",
    defaultOn: false,
  },
];

export const LAYER_BY_ID: Record<LayerId, LayerMeta> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l])
) as Record<LayerId, LayerMeta>;
