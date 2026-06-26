"use client";

import { useWorldView, type RightPanel } from "@/lib/store";
import Controls from "./Controls";
import LayerCategories from "./LayerCategories";

/**
 * Top bar (Google-Maps-style shell). Left: utility tabs (Intel · Add Data ·
 * Tools) that open the right-side overlay panels — styled identically to the
 * layer-category tabs (pill + colored dot). Then the layer categories. Right:
 * Reset / Locate.
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
  const intelCount = useWorldView((s) => s.intel.length);
  const userLayerCount = useWorldView((s) => s.userLayers.length);
  const countFor = (id: RightPanel) =>
    id === "intel" ? intelCount : id === "userdata" ? userLayerCount : 0;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-1 border-b border-wv-border px-2 backdrop-blur-md"
      style={{ background: "rgba(7,4,14,0.96)" }}
    >
      <div className="flex items-center gap-1">
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
              {count > 0 && (
                <span className="tabular-nums opacity-80">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <span className="mx-1 h-7 w-px bg-wv-border" />
      <LayerCategories />

      <div className="ml-auto flex items-center">
        <Controls onReset={onReset} onLocate={onLocate} />
      </div>
    </div>
  );
}
