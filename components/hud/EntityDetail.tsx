"use client";

import { useWorldView } from "@/lib/store";
import { LAYER_BY_ID } from "@/lib/layers";
import type { FeedEntity } from "@/lib/types";
import FlightExtras from "./FlightExtras";
import VesselExtras from "./VesselExtras";

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
    case "flights": {
      const knots = Math.round(e.velocity * 1.94384);
      const vs = e.verticalRate;
      const vsStr =
        vs > 0.3
          ? `▲ ${Math.abs(vs).toFixed(1)} m/s`
          : vs < -0.3
            ? `▼ ${Math.abs(vs).toFixed(1)} m/s`
            : "LEVEL";
      const rows: [string, React.ReactNode][] = [
        ["STATUS", e.onGround ? "ON GROUND" : "AIRBORNE"],
      ];
      if (e.aircraftType) rows.push(["TYPE", e.aircraftType]);
      if (e.registration) rows.push(["REG", e.registration]);
      if (e.country) rows.push(["ORIGIN", e.country]);
      rows.push(
        ["ALT", `${Math.round(e.altitude).toLocaleString()} m`],
        ["SPD", `${knots} kn`],
        ["HDG", `${Math.round(e.heading)}°`],
        ["V/S", vsStr],
        ["ICAO", e.id.toUpperCase()]
      );
      return { title: e.callsign, rows };
    }
    case "ships": {
      const rows: [string, React.ReactNode][] = [["TYPE", e.type]];
      if (e.flag) rows.push(["FLAG", e.flag]);
      if (e.status) rows.push(["STATUS", e.status]);
      rows.push(
        ["COURSE", `${Math.round(e.heading)}°`],
        ["SPEED", `${e.speed.toFixed(1)} kn`]
      );
      if (e.length)
        rows.push([
          "SIZE",
          e.beam
            ? `${Math.round(e.length)} × ${Math.round(e.beam)} m`
            : `${Math.round(e.length)} m`,
        ]);
      if (e.draught) rows.push(["DRAUGHT", `${e.draught.toFixed(1)} m`]);
      if (e.destination) rows.push(["DEST", e.destination]);
      if (e.eta) rows.push(["ETA", e.eta]);
      rows.push(["MMSI", e.id]);
      if (e.imo) rows.push(["IMO", String(e.imo)]);
      if (e.callsign) rows.push(["CALLSIGN", e.callsign]);
      return { title: e.name, rows };
    }
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

/**
 * Detail for the currently selected globe entity — rendered inside the right
 * rail's side panel (content only; the rail provides the panel chrome/header).
 * Shows an empty state when nothing is selected.
 */
export default function EntityBody({
  onFlyTo,
}: {
  onFlyTo: (lon: number, lat: number, h?: number) => void;
}) {
  const selected = useWorldView((s) => s.selected);

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-2xl text-wv-muted">⌖</span>
        <span className="text-[10px] tracking-widest text-wv-muted">
          NO CONTACT SELECTED
        </span>
        <span className="text-[9px] leading-relaxed text-wv-muted/70">
          Click any contact on the globe to inspect it here.
        </span>
      </div>
    );
  }

  const meta = LAYER_BY_ID[selected.kind];
  const { title, rows } = fields(selected);
  const e = selected as unknown as { lon: number; lat: number; altKm?: number };

  return (
    <div className="px-3 py-3">
      <div
        className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em]"
        style={{ color: meta.color }}
      >
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </div>
      <div>
        <div
          className="mb-2 truncate text-[13px] font-bold"
          style={{ color: meta.color }}
        >
          {title}
        </div>

        {/* aircraft photo + live world-count + history link */}
        {selected.kind === "flights" && (
          <FlightExtras hex={selected.id} reg={selected.registration} />
        )}

        {/* real vessel photo (VesselFinder) + live vessel count */}
        {selected.kind === "ships" && (
          <VesselExtras mmsi={selected.id} name={selected.name} />
        )}

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
