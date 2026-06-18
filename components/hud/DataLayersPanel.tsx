"use client";

import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";

export default function DataLayersPanel() {
  const layers = useWorldView((s) => s.layers);
  const counts = useWorldView((s) => s.counts);
  const toggleLayer = useWorldView((s) => s.toggleLayer);

  return (
    <div className="hud-panel corner-ticks fixed top-24 left-3 z-40 w-60">
      <div className="hud-panel-header flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-bold tracking-[0.2em] text-wv-text">
          DATA LAYERS
        </span>
        <span className="text-[9px] tracking-widest text-wv-muted">
          {LAYERS.filter((l) => layers[l.id]).length}/{LAYERS.length}
        </span>
      </div>

      <div className="p-1.5">
        {LAYERS.map((l) => {
          const on = layers[l.id];
          return (
            <button
              key={l.id}
              onClick={() => toggleLayer(l.id)}
              className={`group flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition-colors ${
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
                  <span
                    className="h-1.5 w-1.5"
                    style={{ background: l.color }}
                  />
                )}
              </span>

              <span
                className="w-4 text-center text-[11px]"
                style={{ color: on ? l.color : "var(--wv-muted)" }}
              >
                {l.icon}
              </span>

              <span className="flex-1">
                <span
                  className="block text-[11px] font-semibold tracking-wide"
                  style={{ color: on ? "var(--wv-text)" : "var(--wv-muted)" }}
                >
                  {l.label}
                </span>
                <span className="block text-[8.5px] tracking-widest text-wv-muted">
                  {l.source}
                </span>
              </span>

              <span
                className="text-[10px] tabular-nums"
                style={{ color: on ? l.color : "var(--wv-muted)" }}
              >
                {on ? counts[l.id] ?? 0 : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
