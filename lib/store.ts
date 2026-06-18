import { create } from "zustand";
import type { FeedEntity, LayerId } from "./types";
import { LAYERS } from "./layers";

interface IntelLine {
  id: number;
  time: string;
  text: string;
  tone: "info" | "warn" | "alert" | "ok";
}

interface WorldViewState {
  layers: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;

  selected: FeedEntity | null;
  setSelected: (e: FeedEntity | null) => void;

  counts: Record<LayerId, number>;
  setCount: (id: LayerId, n: number) => void;

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
  setSelected: (e) => set({ selected: e }),

  counts: initialCounts,
  setCount: (id, n) => set((s) => ({ counts: { ...s.counts, [id]: n } })),

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
