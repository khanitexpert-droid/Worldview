"use client";

import { useRef } from "react";
import { useWorldView } from "@/lib/store";

/**
 * MY DATA — imported GIS layers. Drop files anywhere on the globe (or browse
 * here) to add GeoJSON / Shapefile-zip / KML / GeoTIFF. Each row controls
 * visibility, color (vector), opacity, zoom-to, and remove.
 */
export default function UserDataPanel({
  onAddFiles,
  onZoom,
}: {
  onAddFiles: (files: File[]) => void;
  onZoom: (id: string) => void;
}) {
  const layers = useWorldView((s) => s.userLayers);
  const toggle = useWorldView((s) => s.toggleUserLayer);
  const remove = useWorldView((s) => s.removeUserLayer);
  const setOpacity = useWorldView((s) => s.setUserLayerOpacity);
  const setColor = useWorldView((s) => s.setUserLayerColor);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-2">
      <button
        onClick={() => fileRef.current?.click()}
        className="mb-2 flex w-full flex-col items-center gap-1 border border-dashed border-wv-border px-3 py-4 text-center transition-colors hover:border-wv-cyan hover:box-glow-cyan"
      >
        <span className="text-lg text-wv-cyan">⤓</span>
        <span className="text-[10px] font-semibold tracking-wide text-wv-text">
          DROP FILES or BROWSE
        </span>
        <span className="text-[9px] text-wv-muted">
          GeoJSON · Shapefile .zip · KML/KMZ
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".geojson,.json,.zip,.shp,.kml,.kmz"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles([...e.target.files]);
          e.target.value = "";
        }}
      />

      {layers.length === 0 ? (
        <p className="px-1 py-3 text-center text-[10px] leading-relaxed text-wv-muted">
          No imported layers yet. Drag a file onto the globe, or use BROWSE.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {layers.map((l) => (
            <div key={l.id} className="border border-wv-border bg-white/[0.02] px-2 py-1.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggle(l.id)}
                  className="text-[12px] text-wv-cyan"
                  aria-label={l.visible ? "hide layer" : "show layer"}
                  title={l.visible ? "Hide" : "Show"}
                >
                  {l.visible ? "◉" : "○"}
                </button>
                <span
                  className="flex-1 truncate text-[11px] font-semibold text-wv-text"
                  title={l.name}
                >
                  {l.name}
                </span>
                <button
                  onClick={() => onZoom(l.id)}
                  className="text-[12px] text-wv-muted hover:text-wv-cyan"
                  aria-label="zoom to layer"
                  title="Zoom to"
                >
                  ⤢
                </button>
                <button
                  onClick={() => remove(l.id)}
                  className="text-[12px] text-wv-muted hover:text-wv-red"
                  aria-label="remove layer"
                  title="Remove"
                >
                  ✕
                </button>
              </div>

              <div className="mt-1 flex items-center gap-2 text-[9px]">
                <span className="uppercase tracking-wider text-wv-violet/80">
                  {l.format}
                </span>
                {l.featureCount != null && (
                  <span className="text-wv-muted">{l.featureCount} features</span>
                )}
                {l.note && <span className="text-wv-muted">{l.note}</span>}
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                {l.kind === "vector" && (
                  <input
                    type="color"
                    value={l.color}
                    onChange={(e) => setColor(l.id, e.target.value)}
                    className="h-4 w-5 cursor-pointer border border-wv-border bg-transparent p-0"
                    aria-label="layer color"
                    title="Color"
                  />
                )}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={l.opacity}
                  onChange={(e) => setOpacity(l.id, Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-wv-cyan"
                  aria-label="layer opacity"
                  title={`Opacity ${Math.round(l.opacity * 100)}%`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
