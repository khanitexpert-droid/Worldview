"use client";

import { useEffect, useRef, useState } from "react";
import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";

function fmt(n: number, axis: "lat" | "lon") {
  const hemi = axis === "lat" ? (n >= 0 ? "N" : "S") : n >= 0 ? "E" : "W";
  return `${Math.abs(n).toFixed(3)}°${hemi}`;
}

/** One metric cell: tiny muted label over a colored value. */
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
    <div className="flex flex-col justify-center px-3 py-1">
      <span className="text-[8px] font-bold tracking-[0.16em] text-wv-muted">{label}</span>
      {children ?? (
        <span className="text-[12px] font-bold tabular-nums leading-tight" style={{ color }}>
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
  const sideOpen = useWorldView((s) => s.sideOpen);

  const [clock, setClock] = useState("––:––:––");
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  // a stable flavor "GPS jam" reading per session (deltasweep-style).
  const gpsJam = useRef(Math.round(18 + Math.random() * 12)).current;

  const active = LAYERS.filter((l) => layers[l.id]).length;
  const aircraft = layers.flights ? counts.flights ?? 0 : 0;
  const vessels = layers.ships ? counts.ships ?? 0 : 0;
  const eventsN =
    (layers.events ? counts.events ?? 0 : 0) +
    (layers.strikes ? counts.strikes ?? 0 : 0) +
    (layers.wevents ? counts.wevents ?? 0 : 0);
  const contacts = LAYERS.reduce((a, l) => a + (layers[l.id] ? counts[l.id] ?? 0 : 0), 0);
  // derived "escalation index" (flavor) — responds to active layers + hot feeds.
  const escalation = Math.min(
    99,
    34 + active * 2 + Math.round(((counts.strikes ?? 0) + (counts.wevents ?? 0) + (counts.conflicts ?? 0)) / 3)
  );

  return (
    <div
      className="hud-panel fixed bottom-3 z-40 flex items-stretch divide-x divide-wv-border overflow-hidden text-[10px]"
      style={{ left: sideOpen ? 372 : 12 }}
    >
      <Cell label="ESCALATION INDEX">
        <div className="flex items-center gap-2">
          <span
            className="text-[12px] font-bold tabular-nums"
            style={{ color: escalation > 66 ? "#ff414e" : escalation > 40 ? "#ffb347" : "#5dff9e" }}
          >
            {escalation}
          </span>
          <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
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
      <Cell label="CONTACTS" value={contacts.toLocaleString()} color="#b14bff" />
      <Cell
        label="COORDINATES"
        value={cursor ? `${fmt(cursor.lat, "lat")} ${fmt(cursor.lon, "lon")}` : "——"}
      />
      <Cell label="UTC" value={`${clock}Z`} color="#00e5ff" />
    </div>
  );
}
