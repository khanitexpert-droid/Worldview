"use client";

import { useEffect, useState } from "react";
import { useWorldView } from "@/lib/store";
import type { AircraftInfo } from "@/app/api/aircraft/route";

type State =
  | { status: "loading" }
  | { status: "done"; info: AircraftInfo }
  | { status: "error" };

/**
 * Flight-only extras for the SELECTED panel: a real photo of the aircraft
 * (planespotters.net, via /api/aircraft) with photographer attribution, plus
 * live "world count" telemetry and an outbound link to the aircraft's history.
 * One network call feeds both the photo and the photo-count line.
 */
export default function FlightExtras({
  hex,
  reg,
}: {
  hex: string;
  reg?: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const airborne = useWorldView((s) => s.counts.flights);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });

    const qs = new URLSearchParams();
    if (hex) qs.set("hex", hex);
    if (reg) qs.set("reg", reg);

    fetch(`/api/aircraft?${qs.toString()}`)
      .then((r) => r.json())
      .then((info: AircraftInfo) => {
        if (alive) setState({ status: "done", info });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });

    return () => {
      alive = false;
    };
  }, [hex, reg]);

  const info = state.status === "done" ? state.info : null;
  const photo = info?.photo ?? null;

  return (
    <div className="mb-2">
      {/* ---- photo ---- */}
      {state.status === "loading" ? (
        <div className="flex h-32 items-center justify-center border border-wv-border bg-black/40">
          <span className="animate-pulse text-[10px] tracking-widest text-wv-muted">
            ACQUIRING IMAGE…
          </span>
        </div>
      ) : photo && photo.large ? (
        <a
          href={photo.link || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block h-32 overflow-hidden border border-wv-border bg-black/40"
          title="View on planespotters.net"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.large}
            alt={`Aircraft ${reg ?? hex}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute bottom-0 right-0 bg-black/70 px-1.5 py-0.5 text-[8px] tracking-wide text-wv-text/80">
            © {photo.photographer}
          </span>
        </a>
      ) : (
        <div className="flex h-32 flex-col items-center justify-center gap-1 border border-wv-border bg-black/40">
          <span className="text-3xl text-wv-muted">✈</span>
          <span className="text-[9px] tracking-widest text-wv-muted">
            NO IMAGE ON RECORD
          </span>
        </div>
      )}

      {/* ---- world-count telemetry ---- */}
      <div className="mt-2 flex justify-between gap-3 text-[10px]">
        <span className="text-wv-muted">AIRBORNE NOW (GLOBAL)</span>
        <span className="text-wv-cyan tabular-nums">
          {airborne.toLocaleString()}
        </span>
      </div>
      {info && info.photoCount > 0 && (
        <div className="flex justify-between gap-3 text-[10px]">
          <span className="text-wv-muted">PHOTOS ON RECORD</span>
          <span className="text-wv-text tabular-nums">{info.photoCount}</span>
        </div>
      )}

      {/* ---- outbound history link ---- */}
      {info?.link && (
        <a
          href={info.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block border border-wv-border py-1.5 text-center text-[10px] font-bold tracking-[0.2em] text-wv-text transition-colors hover:border-wv-magenta hover:text-wv-magenta hover:box-glow-magenta"
        >
          ✈ AIRCRAFT HISTORY ↗
        </a>
      )}
    </div>
  );
}
