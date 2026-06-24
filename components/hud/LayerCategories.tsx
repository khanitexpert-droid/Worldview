"use client";

import { useEffect, useRef, useState } from "react";
import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";

// Layer categories (deltasweep-style). Each opens a dropdown of toggleable
// layers. Driven by each layer's `group` in lib/layers.ts.
const CATS: { id: string; color: string }[] = [
  { id: "AIR", color: "#00e5ff" },
  { id: "SEA", color: "#4aa3ff" },
  { id: "GROUND", color: "#ffb347" },
  { id: "IMAGERY", color: "#5dff9e" },
];

export default function LayerCategories() {
  const layers = useWorldView((s) => s.layers);
  const counts = useWorldView((s) => s.counts);
  const toggleLayer = useWorldView((s) => s.toggleLayer);
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // close the open dropdown on an outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="flex items-center gap-1">
      {CATS.map((cat) => {
        const items = LAYERS.filter((l) => l.group === cat.id);
        if (!items.length) return null;
        const active = items.filter((l) => layers[l.id]).length;
        const isOpen = open === cat.id;
        return (
          <div key={cat.id} className="relative">
            <button
              onClick={() => setOpen(isOpen ? null : cat.id)}
              className="flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-[10px] font-bold tracking-[0.1em] transition-colors"
              style={{
                borderColor: isOpen || active ? cat.color : "var(--wv-border)",
                color: isOpen || active ? cat.color : "var(--wv-muted)",
                background: isOpen ? `${cat.color}1a` : "transparent",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: cat.color, boxShadow: active ? `0 0 6px ${cat.color}` : "none" }}
              />
              {cat.id}
              {active > 0 && <span className="tabular-nums opacity-80">{active}</span>}
              <span className="text-[8px] opacity-70">▾</span>
            </button>

            {isOpen && (
              <div className="wv-panel-in hud-panel absolute left-0 top-full z-50 mt-1 w-56 py-1">
                <div className="px-3 pb-1 pt-1 text-[9px] font-bold tracking-[0.2em] text-wv-muted">
                  {cat.id} · {active}/{items.length} ACTIVE
                </div>
                {items.map((l) => {
                  const on = layers[l.id];
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleLayer(l.id)}
                      title={l.info}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                        on ? "bg-white/[0.04]" : "opacity-75 hover:opacity-100"
                      }`}
                    >
                      <span
                        className="flex h-3 w-3 shrink-0 items-center justify-center border"
                        style={{
                          borderColor: on ? l.color : "var(--wv-border)",
                          boxShadow: on ? `0 0 8px ${l.color}` : "none",
                        }}
                      >
                        {on && <span className="h-1.5 w-1.5" style={{ background: l.color }} />}
                      </span>
                      <span
                        className="w-4 text-center text-[12px]"
                        style={{ color: on ? l.color : "var(--wv-muted)" }}
                      >
                        {l.icon}
                      </span>
                      <span
                        className="flex-1 text-[11px] font-semibold"
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
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
