"use client";

import { useWorldView, type RightPanel } from "@/lib/store";
import Controls from "./Controls";
import LayerCategories from "./LayerCategories";

/**
 * Top bar (deltasweep-style shell). Left: the layer-category tabs. Right: utility
 * tabs (Intel · Add Data · Tools) + Clear + view controls — all styled as pills
 * with a colored dot.
 */
const TABS: { id: RightPanel; label: string; color: string }[] = [
  { id: "intel", label: "INTEL", color: "#ff2d95" },
  { id: "userdata", label: "ADD DATA", color: "#00e5ff" },
  { id: "tools", label: "TOOLS", color: "#aaff00" },
];

export default function TopBar({
  onReset,
  onLocate,
}: {
  onReset: () => void;
  onLocate: () => void;
}) {
  const open = useWorldView((s) => s.rightPanel);
  const toggle = useWorldView((s) => s.toggleRightPanel);
  const clearLayers = useWorldView((s) => s.clearLayers);
  const intelCount = useWorldView((s) => s.intel.length);
  const userLayerCount = useWorldView((s) => s.userLayers.length);
  const activeCount = useWorldView((s) =>
    Object.values(s.layers).filter(Boolean).length
  );
  const countFor = (id: RightPanel) =>
    id === "intel" ? intelCount : id === "userdata" ? userLayerCount : 0;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-1 border-b border-wv-border px-2 backdrop-blur-md"
      style={{ background: "rgba(7,4,14,0.96)" }}
    >
      {/* layer categories — spread across the bar to fill the width */}
      <LayerCategories className="flex flex-1 items-center justify-between gap-1 pr-2" />

      {/* utility tabs + clear + controls — kept compact on the right */}
      <div className="flex shrink-0 items-center gap-1">
        {TABS.map((t) => {
          const on = open === t.id;
          const count = countFor(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              title={t.label}
              aria-label={t.label}
              aria-pressed={on}
              className="flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-[10px] font-bold tracking-[0.1em] transition-colors"
              style={{
                borderColor: on ? t.color : "var(--wv-border)",
                color: on ? t.color : "var(--wv-muted)",
                background: on ? `${t.color}1a` : "transparent",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: t.color, boxShadow: on ? `0 0 6px ${t.color}` : "none" }}
              />
              {t.label}
              {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
            </button>
          );
        })}

        {/* CLEAR — turn off every active data layer */}
        <button
          onClick={clearLayers}
          disabled={activeCount === 0}
          title="Clear all active layers"
          aria-label="Clear all active layers"
          className="flex items-center gap-1.5 rounded-sm border border-wv-border px-2 py-1.5 text-[10px] font-bold tracking-[0.1em] transition-colors enabled:hover:border-wv-red enabled:hover:text-wv-red disabled:opacity-40"
          style={{ color: activeCount > 0 ? "#ff4d4d" : "var(--wv-muted)" }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "#ff4d4d", boxShadow: activeCount > 0 ? "0 0 6px #ff4d4d" : "none" }}
          />
          CLEAR
          {activeCount > 0 && <span className="tabular-nums opacity-80">{activeCount}</span>}
        </button>

        <span className="mx-1 h-7 w-px bg-wv-border" />
        <Controls onReset={onReset} onLocate={onLocate} />
      </div>
    </div>
  );
}
