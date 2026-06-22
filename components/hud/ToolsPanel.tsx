"use client";

import { useEffect } from "react";
import { useWorldView } from "@/lib/store";
import type { MeasureMode, MeasureUnit } from "@/lib/globeTools";

interface ToolsProps {
  onScreenshot: () => void;
  onClearMeasure: () => void;
  onClearHighlight: () => void;
}

const MEASURE_GREEN = "#aaff00";
const HIGHLIGHT_GOLD = "#ffe14d";

/**
 * TOOLS panel — globe utilities (content only; the rail provides the chrome).
 * Measure (distance / radius, km·nm·mi), Highlight, and a one-shot PNG Screenshot.
 * Selecting Measure/Highlight arms the globe; clicking points draws on the map.
 */
export default function ToolsPanel({
  onScreenshot,
  onClearMeasure,
  onClearHighlight,
}: ToolsProps) {
  const activeTool = useWorldView((s) => s.activeTool);
  const setActiveTool = useWorldView((s) => s.setActiveTool);
  const measureMode = useWorldView((s) => s.measureMode);
  const setMeasureMode = useWorldView((s) => s.setMeasureMode);
  const measureUnit = useWorldView((s) => s.measureUnit);
  const setMeasureUnit = useWorldView((s) => s.setMeasureUnit);
  const measureReadout = useWorldView((s) => s.measureReadout);

  // leaving the panel disarms any active tool so normal clicks select again
  useEffect(() => () => setActiveTool(null), [setActiveTool]);

  const tool = (
    id: "measure" | "highlight",
    label: string,
    icon: string,
    color: string
  ) => {
    const on = activeTool === id;
    return (
      <button
        onClick={() => setActiveTool(on ? null : id)}
        className={`group flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors ${
          on ? "bg-white/[0.04]" : "opacity-70 hover:opacity-100"
        }`}
      >
        <span
          className="flex h-3 w-3 shrink-0 items-center justify-center border"
          style={{
            borderColor: on ? color : "var(--wv-border)",
            boxShadow: on ? `0 0 8px ${color}` : "none",
          }}
        >
          {on && <span className="h-1.5 w-1.5" style={{ background: color }} />}
        </span>
        <span className="w-4 text-center text-[11px]">{icon}</span>
        <span
          className="flex-1 text-[11px] font-semibold tracking-wide"
          style={{ color: on ? "var(--wv-text)" : "var(--wv-muted)" }}
        >
          {label}
        </span>
        <span className="text-[9px] tracking-widest" style={{ color }}>
          {on ? "ARMED" : ""}
        </span>
      </button>
    );
  };

  const seg = <T extends string>(
    value: T,
    current: T,
    set: (v: T) => void,
    label: string,
    color: string
  ) => (
    <button
      onClick={() => set(value)}
      className="flex-1 border px-2 py-1.5 text-[10px] font-bold tracking-[0.15em] transition-colors"
      style={{
        borderColor: current === value ? color : "var(--wv-border)",
        color: current === value ? color : "var(--wv-muted)",
        background: current === value ? `${color}1a` : "transparent",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="p-2">
      {tool("measure", "MEASURE", "📐", MEASURE_GREEN)}

      {activeTool === "measure" && (
        <div className="mb-2 ml-1 border-l border-wv-border pl-3 pt-1">
          <div className="mb-1.5 flex gap-1.5">
            {seg<MeasureMode>(
              "distance",
              measureMode,
              setMeasureMode,
              "DISTANCE",
              MEASURE_GREEN
            )}
            {seg<MeasureMode>(
              "radius",
              measureMode,
              setMeasureMode,
              "RADIUS",
              MEASURE_GREEN
            )}
          </div>
          <div className="mb-1.5 flex gap-1.5">
            {(["km", "nm", "mi"] as MeasureUnit[]).map((u) => (
              <span key={u} className="flex-1">
                {seg<MeasureUnit>(
                  u,
                  measureUnit,
                  setMeasureUnit,
                  u.toUpperCase(),
                  MEASURE_GREEN
                )}
              </span>
            ))}
          </div>
          {measureReadout && (
            <div className="mb-1.5 text-[11px] font-bold tabular-nums text-wv-text">
              {measureMode === "radius" ? "RADIUS" : "TOTAL"} ·{" "}
              <span style={{ color: MEASURE_GREEN }}>{measureReadout}</span>
            </div>
          )}
          <button
            onClick={onClearMeasure}
            className="w-full border border-wv-red/60 py-1.5 text-[10px] font-bold tracking-[0.2em] text-wv-red transition-colors hover:bg-wv-red/10"
          >
            CLEAR
          </button>
          <p className="mt-1.5 text-[9px] leading-relaxed text-wv-muted">
            {measureMode === "radius"
              ? "Click the centre, then the edge."
              : "Click two points to measure · click again to extend."}
          </p>
        </div>
      )}

      {tool("highlight", "HIGHLIGHT", "🖍", HIGHLIGHT_GOLD)}

      {activeTool === "highlight" && (
        <div className="mb-2 ml-1 border-l border-wv-border pl-3 pt-1">
          <button
            onClick={onClearHighlight}
            className="w-full border border-wv-red/60 py-1.5 text-[10px] font-bold tracking-[0.2em] text-wv-red transition-colors hover:bg-wv-red/10"
          >
            CLEAR
          </button>
          <p className="mt-1.5 text-[9px] leading-relaxed text-wv-muted">
            Click the globe to highlight a spot.
          </p>
        </div>
      )}

      {/* screenshot is a one-shot action, not an armed tool */}
      <button
        onClick={onScreenshot}
        className="group mt-1 flex w-full items-center gap-2.5 px-2 py-2 text-left opacity-70 transition-opacity hover:opacity-100"
      >
        <span className="flex h-3 w-3 shrink-0 items-center justify-center border border-wv-border" />
        <span className="w-4 text-center text-[11px]">▦</span>
        <span className="flex-1 text-[11px] font-semibold tracking-wide text-wv-muted group-hover:text-wv-text">
          SCREENSHOT
        </span>
        <span className="text-[9px] tracking-widest text-wv-cyan">PNG</span>
      </button>
    </div>
  );
}
