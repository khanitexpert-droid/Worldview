"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useWorldView } from "@/lib/store";
import { LAYERS, type LayerMeta } from "@/lib/layers";

interface Tip {
  label: string;
  color: string;
  info: string;
  top: number;
  left: number;
}

/**
 * Layer toggles — rendered inside the right rail's side panel (the rail
 * provides the panel chrome/header, so this is content only). Hovering a row
 * pops a little context card (what the layer is / a fun fact) to its right.
 */
export default function LayersBody() {
  const layers = useWorldView((s) => s.layers);
  const counts = useWorldView((s) => s.counts);
  const toggleLayer = useWorldView((s) => s.toggleLayer);
  const [tip, setTip] = useState<Tip | null>(null);

  const openTip = (e: React.MouseEvent<HTMLElement>, l: LayerMeta) => {
    const r = e.currentTarget.getBoundingClientRect();
    // sit the card just to the right of the panel (the globe area is empty there)
    let left = r.right + 12;
    // only clamp to the viewport when we actually have a sane width — some
    // embedded webviews report a bogus innerWidth.
    if (window.innerWidth > 300) left = Math.min(left, window.innerWidth - 268);
    const vh = window.innerHeight > 300 ? window.innerHeight : 800;
    const top = Math.max(8, Math.min(r.top - 4, vh - 190));
    setTip({ label: l.label, color: l.color, info: l.info, top, left });
  };

  return (
    <div className="p-1.5">
      {LAYERS.map((l, i) => {
        const on = layers[l.id];
        // print a small category header when the group changes (e.g. "GROUND")
        const groupHeader =
          l.group && l.group !== LAYERS[i - 1]?.group ? l.group : null;
        return (
          <div key={l.id}>
            {groupHeader && (
              <div className="mt-2 mb-0.5 px-2 text-[9px] font-bold tracking-[0.25em] text-wv-muted/80">
                {groupHeader}
              </div>
            )}
            <button
              onClick={() => toggleLayer(l.id)}
              onMouseEnter={(e) => openTip(e, l)}
              onMouseLeave={() => setTip(null)}
              className={`group flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors ${
                on ? "bg-white/[0.03]" : "opacity-55 hover:opacity-90"
              }`}
            >
            {/* toggle pip */}
            <span
              className="flex h-3 w-3 shrink-0 items-center justify-center border"
              style={{
                borderColor: on ? l.color : "var(--wv-border)",
                boxShadow: on ? `0 0 8px ${l.color}` : "none",
              }}
            >
              {on && (
                <span className="h-1.5 w-1.5" style={{ background: l.color }} />
              )}
            </span>

            <span
              className="w-4 text-center text-[11px]"
              style={{ color: on ? l.color : "var(--wv-muted)" }}
            >
              {l.icon}
            </span>

            <span
              className="flex-1 text-[11px] font-semibold tracking-wide"
              style={{ color: on ? "var(--wv-text)" : "var(--wv-muted)" }}
            >
              {l.label}
            </span>

            <span
              className="text-[10px] tabular-nums"
              style={{ color: on ? l.color : "var(--wv-muted)" }}
            >
              {l.noCount ? (on ? "ON" : "—") : on ? counts[l.id] ?? 0 : "—"}
            </span>
            </button>
          </div>
        );
      })}

      {/* hover context card — portalled to <body> so the panel's overflow
          doesn't clip it */}
      {tip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="wv-panel-in hud-panel corner-ticks pointer-events-none fixed z-[70] w-64 p-3"
            style={{ top: tip.top, left: tip.left }}
          >
            <div
              className="mb-1.5 text-[10px] font-bold tracking-[0.18em]"
              style={{ color: tip.color }}
            >
              {tip.label}
            </div>
            <p className="text-[10px] leading-relaxed text-wv-text/85">
              {tip.info}
            </p>
          </div>,
          document.body
        )}
    </div>
  );
}
