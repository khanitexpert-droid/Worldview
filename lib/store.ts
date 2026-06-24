import { create } from "zustand";
import type { FeedEntity, LayerId, SatOrbit, UserLayer } from "./types";
import type { MeasureMode, MeasureUnit } from "./globeTools";
import { LAYERS } from "./layers";

/** an active on-globe tool (TOOLS panel). Screenshot is a one-shot action. */
export type ToolId = "measure" | "highlight";

interface IntelLine {
  id: number;
  time: string;
  text: string;
  tone: "info" | "warn" | "alert" | "ok";
}

/** which contextual side panel the right rail has open (null = collapsed) */
export type RightPanel = "intel" | "userdata" | "tools";

/** which content tab the left side panel (deltasweep-style) is showing */
export type SideTab = "caspian" | "activity" | "news" | "markets" | "missiles";

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

  // ---- left side panel (deltasweep-style intel tabs) ----
  sideTab: SideTab;
  setSideTab: (t: SideTab) => void;
  sideOpen: boolean;
  toggleSide: () => void;
  setSideOpen: (v: boolean) => void;
  // which missile range rings are shown on the globe (per-missile, by id)
  missileRingIds: string[];
  toggleMissileRing: (id: string) => void;

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

  // ---- TOOLS (measure / highlight) ----
  activeTool: ToolId | null;
  setActiveTool: (t: ToolId | null) => void;
  measureMode: MeasureMode;
  setMeasureMode: (m: MeasureMode) => void;
  measureUnit: MeasureUnit;
  setMeasureUnit: (u: MeasureUnit) => void;
  measureReadout: string | null; // live total/radius shown in the panel
  setMeasureReadout: (s: string | null) => void;

  // ---- user-imported GIS layers (drag-dropped files) ----
  userLayers: UserLayer[];
  addUserLayer: (l: UserLayer) => void;
  removeUserLayer: (id: string) => void;
  toggleUserLayer: (id: string) => void;
  setUserLayerOpacity: (id: string, opacity: number) => void;
  setUserLayerColor: (id: string, color: string) => void;
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
  // picking an entity on the globe shows the compact SelectedPopup (driven by
  // `selected`); the right-side overlay panels are unaffected.
  setSelected: (e) => set({ selected: e }),
  updateSelected: (e) => set({ selected: e }),

  rightPanel: null,
  toggleRightPanel: (p) =>
    set((s) => ({ rightPanel: s.rightPanel === p ? null : p })),
  setRightPanel: (p) => set({ rightPanel: p }),

  sideTab: "markets",
  setSideTab: (t) => set({ sideTab: t }),
  sideOpen: true,
  toggleSide: () => set((s) => ({ sideOpen: !s.sideOpen })),
  setSideOpen: (v) => set({ sideOpen: v }),
  missileRingIds: [],
  toggleMissileRing: (id) =>
    set((s) => ({
      missileRingIds: s.missileRingIds.includes(id)
        ? s.missileRingIds.filter((x) => x !== id)
        : [...s.missileRingIds, id],
    })),

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

  activeTool: null,
  setActiveTool: (t) => set({ activeTool: t }),
  measureMode: "distance",
  setMeasureMode: (m) => set({ measureMode: m }),
  measureUnit: "km",
  setMeasureUnit: (u) => set({ measureUnit: u }),
  measureReadout: null,
  setMeasureReadout: (s) => set({ measureReadout: s }),

  userLayers: [],
  addUserLayer: (l) => set((s) => ({ userLayers: [l, ...s.userLayers] })),
  removeUserLayer: (id) =>
    set((s) => ({ userLayers: s.userLayers.filter((l) => l.id !== id) })),
  toggleUserLayer: (id) =>
    set((s) => ({
      userLayers: s.userLayers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),
  setUserLayerOpacity: (id, opacity) =>
    set((s) => ({
      userLayers: s.userLayers.map((l) =>
        l.id === id ? { ...l, opacity } : l
      ),
    })),
  setUserLayerColor: (id, color) =>
    set((s) => ({
      userLayers: s.userLayers.map((l) => (l.id === id ? { ...l, color } : l)),
    })),
}));

// dev-only handle for debugging/verification (stripped from production bundles)
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __wv?: typeof useWorldView }).__wv = useWorldView;
}
