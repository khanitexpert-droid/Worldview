"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";

// Layer categories (deltasweep-style). Each opens a dropdown of toggleable
// layers. Driven by each layer's `group` in lib/layers.ts. A layer may also set
// a `subgroup` (e.g. INFRA → ENERGY / CIVILIAN) which prints a sub-header inside
// the dropdown.
const CATS: { id: string; color: string }[] = [
  { id: "AIR", color: "#00e5ff" },
  { id: "SEA", color: "#4aa3ff" },
  { id: "GROUND", color: "#ffb347" },
  { id: "INFRA", color: "#f5a623" },
  { id: "ENVIRO", color: "#3ddc97" },
  { id: "IMAGERY", color: "#5dff9e" },
];

export default function LayerCategories() {
  const layers = useWorldView((s) => s.layers);
  const counts = useWorldView((s) => s.counts);
  const toggleLayer = useWorldView((s) => s.toggleLayer);
  const selected = useWorldView((s) => s.selected);
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

  // picking a globe marker selects an entity → close any open category dropdown
  // (deltasweep behavior: the menu gets out of the way of the detail popup). Only
  // fires on a new selection, so reopening the menu later keeps the selection.
  useEffect(() => {
    if (selected) setOpen(null);
  }, [selected]);

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
              <div className="wv-panel-in hud-panel wv-scroll absolute left-0 top-full z-50 mt-1 max-h-[72vh] w-56 overflow-y-auto py-1">
                <div className="px-3 pb-1 pt-1 text-[9px] font-bold tracking-[0.2em] text-wv-muted">
                  {cat.id} · {active}/{items.length} ACTIVE
                </div>
                {(() => {
                  let lastSub: string | undefined;
                  return items.map((l) => {
                    const on = layers[l.id];
                    const showSub = !!l.subgroup && l.subgroup !== lastSub;
                    lastSub = l.subgroup;
                    return (
                      <Fragment key={l.id}>
                        {showSub && (
                          <div className="px-3 pb-0.5 pt-2 text-[8px] font-bold tracking-[0.22em] text-wv-muted/70">
                            {l.subgroup}
                          </div>
                        )}
                    <button
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
                      </Fragment>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
