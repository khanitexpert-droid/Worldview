"use client";

import { useWorldView } from "@/lib/store";
import { LAYER_BY_ID } from "@/lib/layers";
import type { FeedEntity } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-wv-muted">{label}</span>
      <span className="text-right text-wv-text tabular-nums">{value}</span>
    </div>
  );
}

function fields(e: FeedEntity): { title: string; rows: [string, React.ReactNode][] } {
  switch (e.kind) {
    case "flights":
      return {
        title: e.callsign,
        rows: [
          ["TYPE", "AIRCRAFT"],
          ["COUNTRY", e.country],
          ["ALT", `${Math.round(e.altitude).toLocaleString()} m`],
          ["HDG", `${Math.round(e.heading)}°`],
          ["SPD", `${Math.round(e.velocity)} m/s`],
          ["ICAO", e.id.toUpperCase()],
        ],
      };
    case "ships":
      return {
        title: e.name,
        rows: [
          ["TYPE", e.type],
          ["HDG", `${Math.round(e.heading)}°`],
          ["SPD", `${e.speed.toFixed(1)} kn`],
          ["MMSI", e.id.replace("MMSI", "")],
        ],
      };
    case "satellites":
      return {
        title: e.name,
        rows: [
          ["TYPE", "SATELLITE"],
          ["ALT", `${e.altKm.toLocaleString()} km`],
          ["NORAD", e.id],
        ],
      };
    case "earthquakes":
      return {
        title: `M${e.mag.toFixed(1)} SEISMIC EVENT`,
        rows: [
          ["REGION", e.place],
          ["MAG", e.mag.toFixed(1)],
          ["DEPTH", `${e.depth.toFixed(0)} km`],
          ["TIME", new Date(e.time).toISOString().slice(11, 19) + "Z"],
        ],
      };
    case "cctv":
      return {
        title: e.name,
        rows: [
          ["TYPE", "CCTV CAMERA"],
          ["STATUS", e.status],
          ["ID", e.id],
        ],
      };
    case "traffic":
      return {
        title: e.road,
        rows: [
          ["TYPE", "ROAD SENSOR"],
          ["CONGESTION", e.level],
        ],
      };
  }
}

export default function EntityDetail({
  onFlyTo,
}: {
  onFlyTo: (lon: number, lat: number, h?: number) => void;
}) {
  const selected = useWorldView((s) => s.selected);
  const setSelected = useWorldView((s) => s.setSelected);
  if (!selected) return null;

  const meta = LAYER_BY_ID[selected.kind];
  const { title, rows } = fields(selected);
  const e = selected as unknown as { lon: number; lat: number; altKm?: number };

  return (
    <div
      className="hud-panel corner-ticks fixed top-20 right-3 z-40 w-72"
      style={{ boxShadow: `0 0 14px ${meta.color}44` }}
    >
      <div
        className="hud-panel-header flex items-center justify-between px-3 py-1.5"
        style={{
          background: `linear-gradient(90deg, ${meta.color}22, transparent)`,
        }}
      >
        <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em]">
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <span className="text-wv-text">{meta.label}</span>
        </span>
        <button
          onClick={() => setSelected(null)}
          className="text-wv-muted transition-colors hover:text-wv-red"
          aria-label="close"
        >
          ✕
        </button>
      </div>

      <div className="px-3 py-2">
        <div
          className="mb-2 truncate text-[13px] font-bold"
          style={{ color: meta.color }}
        >
          {title}
        </div>

        {/* CCTV mock viewport */}
        {selected.kind === "cctv" && (
          <div className="mb-2 flex h-28 items-center justify-center border border-wv-border bg-black/60 text-[10px] tracking-widest text-wv-muted">
            {selected.status === "ONLINE" ? (
              <span className="flex items-center gap-2 text-wv-cyan">
                <span className="wv-live-dot h-1.5 w-1.5 rounded-full bg-wv-red" />
                ● LIVE FEED // SIM
              </span>
            ) : (
              <span className="text-wv-red">CAMERA OFFLINE OR UNREACHABLE</span>
            )}
          </div>
        )}

        <div className="text-[10px]">
          {rows.map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
          <Row
            label="POS"
            value={`${e.lat.toFixed(3)}, ${e.lon.toFixed(3)}`}
          />
        </div>

        <button
          onClick={() =>
            onFlyTo(
              e.lon,
              e.lat,
              selected.kind === "satellites" ? 8_000_000 : 400_000
            )
          }
          className="mt-3 w-full border border-wv-border py-1.5 text-[10px] font-bold tracking-[0.2em] text-wv-text transition-colors hover:border-wv-cyan hover:text-wv-cyan hover:box-glow-cyan"
        >
          ⌖ LOCK & TRACK
        </button>
      </div>
    </div>
  );
}
