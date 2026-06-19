"use client";

import { useEffect, useState } from "react";
import { useWorldView } from "@/lib/store";
import type { VesselPhoto } from "@/app/api/vessel-photo/route";

type State =
  | { status: "loading" }
  | { status: "done"; data: VesselPhoto }
  | { status: "error" };

/**
 * Vessel-only extras for the SELECTED panel: a best-effort photo (Wikipedia /
 * Wikimedia Commons, keyed by ship name) plus the live global vessel count.
 * Ship photos have no universal free source, so the "no image" fallback is the
 * common case — that's expected.
 */
export default function VesselExtras({
  mmsi,
  name,
}: {
  mmsi: string;
  name: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const tracked = useWorldView((s) => s.counts.ships);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });

    const qs = new URLSearchParams();
    if (mmsi) qs.set("mmsi", mmsi);
    if (name) qs.set("name", name);

    fetch(`/api/vessel-photo?${qs.toString()}`)
      .then((r) => r.json())
      .then((data: VesselPhoto) => {
        if (alive) setState({ status: "done", data });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });

    return () => {
      alive = false;
    };
  }, [mmsi, name]);

  const photo = state.status === "done" ? state.data.photo : null;

  return (
    <div className="mb-2">
      {state.status === "loading" ? (
        <div className="flex h-32 items-center justify-center border border-wv-border bg-black/40">
          <span className="animate-pulse text-[10px] tracking-widest text-wv-muted">
            SEARCHING IMAGERY…
          </span>
        </div>
      ) : photo && photo.large ? (
        <a
          href={photo.link || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block h-32 overflow-hidden border border-wv-border bg-black/40"
          title="View on Wikipedia"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.large}
            alt={`Vessel ${name}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute bottom-0 right-0 bg-black/70 px-1.5 py-0.5 text-[8px] tracking-wide text-wv-text/80">
            {photo.attribution}
          </span>
        </a>
      ) : (
        <div className="flex h-32 flex-col items-center justify-center gap-1 border border-wv-border bg-black/40">
          <span className="text-3xl text-wv-muted">⚓</span>
          <span className="text-[9px] tracking-widest text-wv-muted">
            NO IMAGE ON RECORD
          </span>
        </div>
      )}

      {/* live global vessel count */}
      <div className="mt-2 flex justify-between gap-3 text-[10px]">
        <span className="text-wv-muted">VESSELS TRACKED (GLOBAL)</span>
        <span className="text-wv-cyan tabular-nums">
          {tracked.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
