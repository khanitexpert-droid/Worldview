"use client";

import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";

function fmt(n: number, axis: "lat" | "lon") {
  const hemi =
    axis === "lat" ? (n >= 0 ? "N" : "S") : n >= 0 ? "E" : "W";
  return `${Math.abs(n).toFixed(3)}°${hemi}`;
}

export default function StatusBar() {
  const counts = useWorldView((s) => s.counts);
  const layers = useWorldView((s) => s.layers);
  const cursor = useWorldView((s) => s.cursor);

  const total = LAYERS.reduce(
    (acc, l) => acc + (layers[l.id] ? counts[l.id] ?? 0 : 0),
    0
  );

  return (
    <div className="hud-panel fixed bottom-3 left-[64px] z-40 flex items-center gap-4 px-3 py-1.5 text-[10px] tracking-wider">
      <span className="flex items-center gap-1.5 text-wv-cyan">
        <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-cyan" />
        ALL SYSTEMS NOMINAL
      </span>
      <span className="text-wv-border">|</span>
      <span className="text-wv-muted">
        CONTACTS{" "}
        <span className="text-wv-magenta tabular-nums">
          {total.toLocaleString()}
        </span>
      </span>
      <span className="text-wv-border">|</span>
      <span className="text-wv-muted">
        CUR{" "}
        <span className="text-wv-text tabular-nums">
          {cursor ? `${fmt(cursor.lat, "lat")}  ${fmt(cursor.lon, "lon")}` : "——"}
        </span>
      </span>
      <span className="text-wv-border">|</span>
      <span className="text-wv-violet/80">WORLDVIEW v1.0.0</span>
    </div>
  );
}
