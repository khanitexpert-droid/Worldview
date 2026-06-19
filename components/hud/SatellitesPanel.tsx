"use client";

import { useWorldView } from "@/lib/store";
import type { SatOrbit } from "@/lib/types";

const ORBIT_META: Record<
  SatOrbit,
  { label: string; sub: string; color: string }
> = {
  LEO: { label: "LOW EARTH ORBIT", sub: "< 2,000 KM", color: "#b14bff" },
  GEO: { label: "GEOSTATIONARY", sub: "~35,786 KM", color: "#ffb347" },
};

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "——" : d.toISOString().slice(11, 19) + "Z";
}

/**
 * SATELLITES rail panel — the operator console for the orbital layer:
 * open-data provenance, LEO/GEO toggles with live counts, and a slot for
 * anything the build needs from the user.
 */
export default function SatellitesBody() {
  const layers = useWorldView((s) => s.layers);
  const toggleLayer = useWorldView((s) => s.toggleLayer);
  const satOrbits = useWorldView((s) => s.satOrbits);
  const toggleSatOrbit = useWorldView((s) => s.toggleSatOrbit);
  const satCounts = useWorldView((s) => s.satCounts);
  const satMeta = useWorldView((s) => s.satMeta);

  const masterOn = layers.satellites;
  const loaded = satMeta !== null;
  const sourceLabel =
    satMeta?.source === "celestrak"
      ? "CELESTRAK · GP"
      : satMeta?.source === "celestrak-mirror"
        ? "CELESTRAK · MIRROR"
        : satMeta?.source === "cache" || satMeta?.source === "cache-stale"
          ? "CELESTRAK · CACHED"
          : satMeta?.source === "fallback"
            ? "UNAVAILABLE"
            : "CELESTRAK · GP";

  return (
    <div className="px-3 py-3 text-[10px]">
      {/* ---- data source / provenance ---- */}
      <div className="mb-3 border border-wv-border bg-white/[0.02] p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="tracking-[0.2em] text-wv-muted">DATA SOURCE</span>
          <span
            className="flex items-center gap-1.5"
            style={{ color: satMeta?.live === false ? "#ffb347" : "#5dff9e" }}
          >
            <span
              className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: satMeta?.live === false ? "#ffb347" : "#5dff9e",
              }}
            />
            {satMeta?.live === false ? "STALE" : "OPEN DATA"}
          </span>
        </div>
        <div className="text-[12px] font-bold text-wv-cyan">{sourceLabel}</div>
        <div className="mt-0.5 leading-relaxed text-wv-muted">
          Live orbital element sets (TLEs), propagated in-browser with SGP4 —
          every satellite moves in real time. No API key required.
        </div>
        <div className="mt-2 flex justify-between border-t border-wv-border/60 pt-1.5 text-wv-muted">
          <span>TRACKED</span>
          <span className="tabular-nums text-wv-text">
            {loaded ? satMeta!.total.toLocaleString() : "loading…"}
          </span>
        </div>
        <div className="flex justify-between text-wv-muted">
          <span>TLE RETRIEVED</span>
          <span className="tabular-nums text-wv-text">
            {loaded ? timeOf(satMeta!.fetchedAt) : "——"}
          </span>
        </div>
      </div>

      {/* ---- master layer toggle ---- */}
      <button
        onClick={() => toggleLayer("satellites")}
        className={`mb-2 flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${
          masterOn
            ? "border-wv-magenta/60 bg-white/[0.03]"
            : "border-wv-border opacity-70 hover:opacity-100"
        }`}
      >
        <span
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center border"
          style={{
            borderColor: masterOn ? "#ff2d95" : "var(--wv-border)",
            boxShadow: masterOn ? "0 0 8px #ff2d95" : "none",
          }}
        >
          {masterOn && <span className="h-2 w-2 bg-wv-magenta" />}
        </span>
        <span className="flex-1">
          <span className="block font-bold tracking-wide text-wv-text">
            SATELLITE LAYER
          </span>
          <span className="block text-[8.5px] tracking-widest text-wv-muted">
            {masterOn ? "BROADCASTING" : "MUTED"}
          </span>
        </span>
        <span className="text-base">🛰</span>
      </button>

      {/* ---- per-orbit toggles ---- */}
      <div className="mb-1 px-0.5 tracking-[0.2em] text-wv-muted">
        ORBIT CLASSES
      </div>
      {(Object.keys(ORBIT_META) as SatOrbit[]).map((o) => {
        const m = ORBIT_META[o];
        const on = satOrbits[o];
        const dim = !masterOn;
        return (
          <button
            key={o}
            onClick={() => toggleSatOrbit(o)}
            disabled={!masterOn}
            className={`group flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition-colors ${
              on && !dim ? "bg-white/[0.03]" : "opacity-55 hover:opacity-90"
            } ${dim ? "cursor-not-allowed" : ""}`}
          >
            <span
              className="flex h-3 w-3 shrink-0 items-center justify-center border"
              style={{
                borderColor: on ? m.color : "var(--wv-border)",
                boxShadow: on && !dim ? `0 0 8px ${m.color}` : "none",
              }}
            >
              {on && <span className="h-1.5 w-1.5" style={{ background: m.color }} />}
            </span>
            <span className="flex-1">
              <span
                className="block font-semibold tracking-wide"
                style={{ color: on ? "var(--wv-text)" : "var(--wv-muted)" }}
              >
                {o} · {m.label}
              </span>
              <span className="block text-[8.5px] tracking-widest text-wv-muted">
                {m.sub}
              </span>
            </span>
            <span
              className="tabular-nums"
              style={{ color: on ? m.color : "var(--wv-muted)" }}
            >
              {satCounts[o].toLocaleString()}
            </span>
          </button>
        );
      })}

      {/* ---- operator requests: anything the build needs from the user ---- */}
      <div className="mt-3 border border-wv-border/70 bg-white/[0.015] p-2.5">
        <div className="mb-1 flex items-center gap-1.5 tracking-[0.2em] text-wv-cyan">
          <span>▣</span> OPERATOR REQUESTS
        </div>
        <div className="leading-relaxed text-wv-muted">
          {satMeta?.source === "fallback" ? (
            <span className="text-wv-amber">
              CelesTrak unreachable from the server. If this persists on your
              deployment, the host region may be blocked — let me know and I can
              proxy the catalogue or wire a Space-Track login.
            </span>
          ) : (
            <>
              <span className="text-wv-green">Nothing needed.</span> Running on
              open-source CelesTrak data — no credentials, no paid feeds.
              <div className="mt-1.5 text-wv-muted/80">
                Optional: provide Space-Track creds to also pull debris &amp;
                MEO/HEO, or a higher refresh cadence.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
