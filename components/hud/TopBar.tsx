"use client";

import type { ReactNode } from "react";
import { useWorldView, type RightPanel } from "@/lib/store";
import Controls from "./Controls";
import LayerCategories from "./LayerCategories";

/**
 * Top bar (Google-Maps-style shell). Left: labeled utility tabs (Layers · Intel ·
 * My Data · Tools) that open the right-side overlay panels. Right: Reset / Locate.
 * Dark, near-solid background with brightened icons + a text label under each.
 */
const TABS: { id: RightPanel; icon: string; label: string }[] = [
  { id: "intel", icon: "≣", label: "INTEL" },
  { id: "userdata", icon: "⤓", label: "ADD DATA" },
  { id: "tools", icon: "⚒", label: "TOOLS" },
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
  const activeTool = useWorldView((s) => s.activeTool);

  const badge = (id: RightPanel): ReactNode => {
    if (id === "intel")
      return intelCount > 0 ? dotBadge("wv-live-dot bg-wv-magenta") : null;
    if (id === "userdata")
      return userLayerCount > 0
        ? countBadge(userLayerCount, "var(--wv-amber)")
        : null;
    if (id === "tools")
      return activeTool
        ? dotBadge("wv-live-dot", {
            background: "#aaff00",
            boxShadow: "0 0 8px #aaff00",
          })
        : null;
    return null;
  };

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex h-14 items-stretch gap-1 border-b border-wv-border px-2 backdrop-blur-md"
      style={{ background: "rgba(7,4,14,0.96)" }}
    >
      {TABS.map((t) => {
        const on = open === t.id;
        return (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            title={t.label}
            aria-label={t.label}
            aria-pressed={on}
            className={`relative flex w-[68px] flex-col items-center justify-center gap-1 rounded-sm transition-colors ${
              on ? "bg-white/[0.07]" : "hover:bg-white/[0.05]"
            }`}
          >
            <span
              className="glow-amber text-[21px] leading-none"
              style={{ color: "#ffe14d" }}
            >
              {t.icon}
            </span>
            <span
              className="text-[9px] font-bold tracking-[0.16em]"
              style={{ color: "#ffe14d" }}
            >
              {t.label}
            </span>
            {on && (
              <span
                className="absolute bottom-0 left-2 right-2 h-[2px]"
                style={{ background: "#ffe14d", boxShadow: "0 0 8px #ffe14d" }}
              />
            )}
            {badge(t.id)}
          </button>
        );
      })}

      <span className="mx-1 h-7 w-px bg-wv-border" />
      <LayerCategories />

      <div className="ml-auto flex items-center">
        <Controls onReset={onReset} onLocate={onLocate} />
      </div>
    </div>
  );
}

function dotBadge(cls: string, style?: React.CSSProperties): ReactNode {
  return (
    <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${cls}`} style={style} />
  );
}
function countBadge(n: number, color: string): ReactNode {
  return (
    <span
      className="absolute right-1.5 top-1.5 min-w-[14px] rounded-full border border-wv-border bg-wv-darker px-1 text-center text-[8px] font-bold leading-[13px]"
      style={{ color }}
    >
      {n}
    </span>
  );
}
