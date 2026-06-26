"use client";

import { useRef, useState } from "react";
import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";

function fmt(n: number, axis: "lat" | "lon") {
  const hemi = axis === "lat" ? (n >= 0 ? "N" : "S") : n >= 0 ? "E" : "W";
  return `${Math.abs(n).toFixed(3)}°${hemi}`;
}

/** One metric cell: small muted label over a colored value (content width). */
function Cell({
  label,
  value,
  color = "var(--wv-text)",
  children,
}: {
  label: string;
  value?: React.ReactNode;
  color?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-center gap-1 px-3 py-2">
      <span className="text-[9px] font-bold tracking-[0.18em] text-wv-muted">{label}</span>
      {children ?? (
        <span className="text-[14px] font-bold tabular-nums leading-none" style={{ color }}>
          {value}
        </span>
      )}
    </div>
  );
}

export default function StatusBar() {
  const counts = useWorldView((s) => s.counts);
  const layers = useWorldView((s) => s.layers);
  const cursor = useWorldView((s) => s.cursor);

  const [min, setMin] = useState(false);
  // a stable flavor "GPS jam" reading per session (deltasweep-style).
  const gpsJam = useRef(Math.round(18 + Math.random() * 12)).current;

  const active = LAYERS.filter((l) => layers[l.id]).length;
  const aircraft = layers.flights ? counts.flights ?? 0 : 0;
  const vessels = layers.ships ? counts.ships ?? 0 : 0;
  const eventsN =
    (layers.events ? counts.events ?? 0 : 0) +
    (layers.strikes ? counts.strikes ?? 0 : 0) +
    (layers.wevents ? counts.wevents ?? 0 : 0);
  // derived "escalation index" (flavor) — responds to active layers + hot feeds.
  const escalation = Math.min(
    99,
    34 + active * 2 + Math.round(((counts.strikes ?? 0) + (counts.wevents ?? 0) + (counts.conflicts ?? 0)) / 3)
  );

  // collapsed → just a small HUD pill (deltasweep-style minimize)
  if (min) {
    return (
      <button
        onClick={() => setMin(false)}
        className="hud-panel fixed bottom-6 left-1/2 z-40 -translate-x-1/2 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-wv-muted transition-colors hover:text-wv-cyan"
      >
        ▼ HUD
      </button>
    );
  }

  return (
    <div className="hud-panel fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-stretch divide-x divide-wv-border overflow-hidden text-[10px]">
      <button
        onClick={() => setMin(true)}
        title="Minimize dashboard"
        aria-label="Minimize dashboard"
        className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-wv-muted transition-colors hover:text-wv-cyan"
      >
        <span className="text-[11px] leading-none">▲</span>
        <span className="text-[9px] font-bold tracking-[0.16em]">HUD</span>
      </button>
      <Cell label="ESCALATION INDEX">
        <div className="flex items-center gap-2">
          <span
            className="text-[14px] font-bold tabular-nums leading-none"
            style={{ color: escalation > 66 ? "#ff414e" : escalation > 40 ? "#ffb347" : "#5dff9e" }}
          >
            {escalation}
          </span>
          <span className="relative h-2 w-14 overflow-hidden rounded-full bg-white/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${escalation}%`,
                background: "linear-gradient(90deg,#5dff9e,#ffb347,#ff414e)",
              }}
            />
          </span>
        </div>
      </Cell>
      <Cell label="GPS JAM" value={`${gpsJam}%`} color="#ff2d95" />
      <Cell label="ACTIVE LAYERS" value={active} color="#00e5ff" />
      <Cell label="AIRCRAFT" value={aircraft.toLocaleString()} color="#00e5ff" />
      <Cell label="VESSELS" value={vessels.toLocaleString()} color="#5dff9e" />
      <Cell label="EVENTS" value={eventsN.toLocaleString()} color="#ffb347" />
      <Cell
        label="COORDINATES"
        value={cursor ? `${fmt(cursor.lat, "lat")} ${fmt(cursor.lon, "lon")}` : "——"}
      />
    </div>
  );
}
