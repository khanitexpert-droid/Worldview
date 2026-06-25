"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityCategory, ActivityEvent } from "@/lib/types";
import { useWorldView } from "@/lib/store";

const POLL_MS = 180_000;

const CAT_COLOR: Record<ActivityCategory, string> = {
  STRIKE: "#ff414e",
  AIR: "#b14bff",
  NAVAL: "#00e5ff",
  GROUND: "#ffb347",
  EXPLOSION: "#ff7a3c",
  DIPLOMATIC: "#5dff9e",
};
const CAT_SHORT: Record<ActivityCategory, string> = {
  STRIKE: "STRIKE",
  AIR: "AIR",
  NAVAL: "NAVAL",
  GROUND: "GND",
  EXPLOSION: "EXPL",
  DIPLOMATIC: "DIPLO",
};
const SEV_COLOR = { HIGH: "#ff414e", MEDIUM: "#ffb347", LOW: "#6c5b8c" };
const FILTERS: ("ALL" | ActivityCategory)[] = [
  "ALL",
  "STRIKE",
  "AIR",
  "NAVAL",
  "GROUND",
  "EXPLOSION",
  "DIPLOMATIC",
];

function ago(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * ACTIVITY — OSINT conflict/incident stream (real data via /api/activity, GDELT
 * conflict coverage classified into categories). Filter chips + clean rows.
 */
export default function ActivityPanel({
  onFlyTo,
}: {
  onFlyTo?: (lon: number, lat: number, h?: number) => void;
}) {
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | ActivityCategory>("ALL");
  const selected = useWorldView((s) => s.selectedActivity);
  const setSelected = useWorldView((s) => s.setSelectedActivity);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/activity", { cache: "no-store" });
        const data = (await res.json()) as { items: ActivityEvent[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        /* keep last good list */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const iv = setInterval(run, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const shown = useMemo(
    () => (filter === "ALL" ? items : items.filter((e) => e.category === filter)),
    [items, filter]
  );

  return (
    <div className="pb-3">
      {/* filter chips */}
      <div className="flex flex-wrap gap-1 border-b border-wv-border px-2 py-2">
        {FILTERS.map((f) => {
          const on = f === filter;
          const color = f === "ALL" ? "var(--wv-text)" : CAT_COLOR[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="border px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
              style={{
                borderColor: on ? color : "var(--wv-border)",
                color: on ? color : "var(--wv-muted)",
                background: on ? `${color}1a` : "transparent",
              }}
            >
              {f === "ALL" ? "ALL" : CAT_SHORT[f]}
            </button>
          );
        })}
      </div>

      {loading && !items.length ? (
        <div className="px-3 py-4 text-[10px] text-wv-muted">Acquiring activity…</div>
      ) : !items.length ? (
        <div className="px-4 py-6 text-center text-[10px] leading-relaxed text-wv-muted">
          No classifiable activity in the live feeds right now — check back shortly.
        </div>
      ) : shown.length === 0 ? (
        <div className="px-3 py-4 text-[10px] text-wv-muted">
          No {CAT_SHORT[filter as ActivityCategory]} events in the last 24h.
        </div>
      ) : (
        shown.map((e) => {
          const on = selected?.id === e.id;
          return (
            <button
              key={e.id}
              onClick={() => {
                setSelected(e);
                if (e.lat != null && e.lon != null) onFlyTo?.(e.lon, e.lat, 900_000);
              }}
              className="group block w-full border-b border-wv-border/40 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
              style={{
                background: on ? "rgba(255,255,255,0.05)" : undefined,
                borderLeft: `2px solid ${on ? CAT_COLOR[e.category] : "transparent"}`,
              }}
            >
              <div className="flex items-center gap-2 text-[8.5px] tracking-[0.12em]">
                <span
                  className="border px-1 py-px font-bold"
                  style={{ color: CAT_COLOR[e.category], borderColor: `${CAT_COLOR[e.category]}66` }}
                >
                  {CAT_SHORT[e.category]}
                </span>
                <span className="font-bold" style={{ color: SEV_COLOR[e.severity] }}>
                  {e.severity}
                </span>
                <span className="ml-auto tabular-nums text-wv-muted">{ago(e.time)}</span>
              </div>
              <div className="mt-1 text-[11px] font-semibold leading-snug text-wv-text/90 group-hover:text-wv-text">
                {e.title}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[8.5px] text-wv-muted">
                <span>{e.domain}</span>
                {e.place && (
                  <span style={{ color: CAT_COLOR[e.category] }}>· {e.place}</span>
                )}
              </div>
            </button>
          );
        })
      )}

      <div className="px-3 pt-2 text-[8.5px] leading-relaxed text-wv-muted/70">
        Live news RSS · keyword-classified · tap an item to locate it on the globe
      </div>
    </div>
  );
}
