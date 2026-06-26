"use client";

import { useWorldView } from "@/lib/store";

// MODIS IGBP land-cover classes (condensed) + canonical palette colors.
const CLASSES: [string, string][] = [
  ["Forest", "#086a10"],
  ["Shrubland", "#dcd159"],
  ["Savanna", "#fbff13"],
  ["Grassland", "#b6ff05"],
  ["Cropland", "#c24f44"],
  ["Urban", "#a5a5a5"],
  ["Wetland", "#27ff87"],
  ["Barren", "#f9ffa4"],
  ["Snow / ice", "#69fff8"],
  ["Water", "#1c0dff"],
];

/** Class legend for the ENVIRO · Land Cover raster, shown only while it's on. */
export default function LandCoverLegend() {
  const on = useWorldView((s) => s.layers.landcover);
  if (!on) return null;
  return (
    <div className="wv-panel-in hud-panel pointer-events-none fixed left-1/2 top-16 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5">
      <span className="text-[9px] font-bold tracking-[0.2em] text-wv-muted">
        LAND COVER
      </span>
      {CLASSES.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: color }}
          />
          <span className="text-[10px] text-wv-text/85">{label}</span>
        </span>
      ))}
    </div>
  );
}
