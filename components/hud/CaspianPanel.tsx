"use client";

import { useEffect, useState } from "react";
import type { CaspianReport } from "@/lib/types";

const POLL_MS = 300_000;

// per-outlet accent for the source tag
const SRC_COLOR: Record<string, string> = {
  "Al Jazeera": "#ff7a3c",
  "France 24": "#00e5ff",
  DW: "#ffe14d",
  "The Guardian": "#5dff9e",
};

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
 * CASPIAN — rolling geopolitical report feed (real data via /api/caspian, free
 * world/geopolitics RSS). Each report: source tag + time, headline, summary.
 * Polls every 5 min while the tab is open.
 */
export default function CaspianPanel() {
  const [items, setItems] = useState<CaspianReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/caspian", { cache: "no-store" });
        const data = (await res.json()) as { items: CaspianReport[] };
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

  return (
    <div className="pb-3">
      <div className="flex items-center justify-between border-b border-wv-border px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.2em] text-wv-muted">
          <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-magenta" />
          REPORT FEED
        </span>
        {items.length > 0 && (
          <span className="text-[9px] tabular-nums text-wv-muted">
            {items.length} items
          </span>
        )}
      </div>

      {loading && !items.length ? (
        <div className="px-3 py-4 text-[10px] text-wv-muted">Acquiring reports…</div>
      ) : (
        items.map((r) => (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border-b border-wv-border/40 px-3 py-2 transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex items-center justify-between text-[8.5px] tracking-[0.14em]">
              <span style={{ color: SRC_COLOR[r.source] ?? "var(--wv-cyan)" }}>
                {r.source.toUpperCase()}
              </span>
              <span className="tabular-nums text-wv-muted">{ago(r.time)}</span>
            </div>
            <div className="mt-1 text-[11px] font-semibold leading-snug text-wv-text/90 group-hover:text-wv-text">
              {r.title}
            </div>
            {r.summary && (
              <div className="mt-1 line-clamp-3 text-[9.5px] leading-relaxed text-wv-muted">
                {r.summary}
              </div>
            )}
          </a>
        ))
      )}

      <div className="px-3 pt-2 text-[8.5px] leading-relaxed text-wv-muted/70">
        Al Jazeera · France 24 · DW · The Guardian · refreshes every 5 min
      </div>
    </div>
  );
}
