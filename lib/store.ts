import { create } from "zustand";
import type { FeedEntity, LayerId, SatOrbit } from "./types";
import { LAYERS } from "./layers";

interface IntelLine {
  id: number;
  time: string;
  text: string;
  tone: "info" | "warn" | "alert" | "ok";
}

/** which contextual side panel the right rail has open (null = collapsed) */
export type RightPanel = "intel" | "selected" | "layers";

/** open-data provenance + freshness for the SATELLITES panel */
export interface SatMeta {
  source: string;
  fetchedAt: string;
  total: number;
  live: boolean;
}

interface WorldViewState {
  layers: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;

  selected: FeedEntity | null;
  setSelected: (e: FeedEntity | null) => void;
  // update the selected entity's data in place WITHOUT changing which panel is
  // open (used to keep a tracked, moving satellite's readout live).
  updateSelected: (e: FeedEntity) => void;

  rightPanel: RightPanel | null;
  toggleRightPanel: (p: RightPanel) => void;
  setRightPanel: (p: RightPanel | null) => void;

  counts: Record<LayerId, number>;
  setCount: (id: LayerId, n: number) => void;

  // ---- satellite sub-state (the satellites layer is split LEO / GEO) ----
  satOrbits: Record<SatOrbit, boolean>;
  toggleSatOrbit: (o: SatOrbit) => void;
  satCounts: Record<SatOrbit, number>;
  setSatCounts: (c: Record<SatOrbit, number>) => void;
  satMeta: SatMeta | null;
  setSatMeta: (m: SatMeta | null) => void;

  intel: IntelLine[];
  pushIntel: (text: string, tone?: IntelLine["tone"]) => void;

  cursor: { lon: number; lat: number } | null;
  setCursor: (c: { lon: number; lat: number } | null) => void;
}

const initialLayers = Object.fromEntries(
  LAYERS.map((l) => [l.id, l.defaultOn])
) as Record<LayerId, boolean>;

const initialCounts = Object.fromEntries(
  LAYERS.map((l) => [l.id, 0])
) as Record<LayerId, number>;

let intelSeq = 0;

export const useWorldView = create<WorldViewState>((set) => ({
  layers: initialLayers,
  toggleLayer: (id) =>
    set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),

  selected: null,
  // picking an entity on the globe auto-opens the SELECTED panel; clearing the
  // selection leaves whatever panel is open (the body shows an empty state).
  setSelected: (e) =>
    set((s) => ({
      selected: e,
      rightPanel: e ? "selected" : s.rightPanel,
    })),
  updateSelected: (e) => set({ selected: e }),

  rightPanel: null,
  toggleRightPanel: (p) =>
    set((s) => ({ rightPanel: s.rightPanel === p ? null : p })),
  setRightPanel: (p) => set({ rightPanel: p }),

  counts: initialCounts,
  setCount: (id, n) => set((s) => ({ counts: { ...s.counts, [id]: n } })),

  satOrbits: { LEO: true, GEO: true },
  toggleSatOrbit: (o) =>
    set((s) => ({ satOrbits: { ...s.satOrbits, [o]: !s.satOrbits[o] } })),
  satCounts: { LEO: 0, GEO: 0 },
  setSatCounts: (c) => set({ satCounts: c }),
  satMeta: null,
  setSatMeta: (m) => set({ satMeta: m }),

  intel: [],
  pushIntel: (text, tone = "info") =>
    set((s) => {
      const time = new Date().toISOString().slice(11, 19);
      const line: IntelLine = { id: ++intelSeq, time, text, tone };
      return { intel: [line, ...s.intel].slice(0, 60) };
    }),

  cursor: null,
  setCursor: (c) => set({ cursor: c }),
}));

// dev-only handle for debugging/verification (stripped from production bundles)
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __wv?: typeof useWorldView }).__wv = useWorldView;
}
