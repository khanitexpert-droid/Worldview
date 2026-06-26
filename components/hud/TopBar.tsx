"use client";

import { useEffect, useState } from "react";
import { useWorldView, type RightPanel } from "@/lib/store";
import Controls from "./Controls";
import LayerCategories from "./LayerCategories";

/**
 * Top bar (deltasweep-style): brand + LIVE on the left, the layer-category +
 * utility tabs in a compact cluster, view controls and the UTC clock on the
 * right. (The bottom-right brand badge is retired in favor of this.)
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

  const [clock, setClock] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-wv-border px-3 backdrop-blur-md"
      style={{ background: "rgba(7,4,14,0.96)" }}
    >
      {/* brand — top-left */}
      <div className="flex shrink-0 items-center gap-2.5 pr-1">
        <div className="leading-none">
          <div className="text-[8px] tracking-[0.22em] text-wv-muted">POWERED BY</div>
          <div className="text-sm font-bold tracking-[0.16em] text-wv-magenta glow-magenta">
            WORLD<span className="text-wv-cyan glow-cyan">VIEW</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-sm border border-wv-border px-2 py-1 text-[10px] font-bold tracking-[0.12em] text-wv-green">
          <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#5dff9e" }} />
          LIVE
        </span>
      </div>

      {/* layer-category tabs (compact) */}
      <LayerCategories />

      {/* utility tabs + clear (compact) */}
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
              {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
            </button>
          );
        })}
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
      </div>

      {/* view controls + UTC clock — top-right */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Controls onReset={onReset} onLocate={onLocate} />
        <div className="text-right leading-none">
          <div className="text-sm font-bold tabular-nums text-wv-cyan glow-cyan">{clock} UTC</div>
          <div className="text-[8px] tracking-[0.24em] text-wv-muted">ZULU</div>
        </div>
      </div>
    </div>
  );
}
