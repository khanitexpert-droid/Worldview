"use client";

import { useWorldView } from "@/lib/store";
import type { ActivityCategory } from "@/lib/types";

const CAT_COLOR: Record<ActivityCategory, string> = {
  STRIKE: "#ff414e",
  AIR: "#b14bff",
  NAVAL: "#00e5ff",
  GROUND: "#ffb347",
  EXPLOSION: "#ff7a3c",
  DIPLOMATIC: "#5dff9e",
};
const CAT_LABEL: Record<ActivityCategory, string> = {
  STRIKE: "STRIKE",
  AIR: "AIR ACTIVITY",
  NAVAL: "NAVAL ACTIVITY",
  GROUND: "GROUND ACTIVITY",
  EXPLOSION: "EXPLOSION",
  DIPLOMATIC: "DIPLOMATIC",
};
const SEV_COLOR: Record<string, string> = { HIGH: "#ff414e", MEDIUM: "#ffb347", LOW: "#6c5b8c" };

function ago(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Row({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-wv-muted">{label}</span>
      <span className="text-right tabular-nums" style={{ color: color ?? "var(--wv-text)" }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Detail card for the clicked ACTIVITY item (deltasweep-style). Type / severity /
 * source / location / coords / time + a source thumbnail (if the feed had one)
 * and a link to the full report. Sits just right of the side panel.
 */
export default function ActivityPopup() {
  const a = useWorldView((s) => s.selectedActivity);
  const setA = useWorldView((s) => s.setSelectedActivity);
  const sideOpen = useWorldView((s) => s.sideOpen);
  if (!a) return null;
  const color = CAT_COLOR[a.category];

  return (
    <div
      className="wv-panel-in hud-panel corner-ticks fixed top-16 z-[45] flex max-h-[80vh] w-[300px] flex-col"
      style={{ left: sideOpen ? 376 : 12 }}
    >
      <button
        onClick={() => setA(null)}
        aria-label="close"
        className="absolute right-2 top-2 z-10 text-wv-muted transition-colors hover:text-wv-red"
      >
        ✕
      </button>

      <div className="wv-scroll overflow-y-auto p-3">
        <div className="mb-2 text-[10px] font-bold tracking-[0.18em]" style={{ color }}>
          // {CAT_LABEL[a.category]}
        </div>
        <div className="mb-2 text-[13px] font-bold" style={{ color }}>
          {a.place ?? a.domain}
        </div>

        {a.image && (
          <img
            src={a.image}
            alt=""
            referrerPolicy="no-referrer"
            className="mb-2 max-h-36 w-full rounded-sm object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        <div className="text-[10.5px] leading-relaxed text-wv-text/90">{a.title}</div>

        <div className="mt-2 text-[10px]">
          <Row label="TYPE" value={CAT_LABEL[a.category]} color={color} />
          <Row label="SEVERITY" value={a.severity} color={SEV_COLOR[a.severity]} />
          <Row label="SOURCE" value={a.domain} />
          {a.place && <Row label="LOCATION" value={a.place} />}
          {a.lat != null && a.lon != null && (
            <Row label="COORDS" value={`${a.lat.toFixed(2)}°, ${a.lon.toFixed(2)}°`} />
          )}
          <Row label="TIME" value={ago(a.time)} />
        </div>

        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full border border-wv-border py-1.5 text-center text-[10px] font-bold tracking-[0.2em] text-wv-text transition-colors hover:border-wv-cyan hover:text-wv-cyan hover:box-glow-cyan"
        >
          OPEN SOURCE →
        </a>
      </div>
    </div>
  );
}
