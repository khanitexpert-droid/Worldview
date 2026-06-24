"use client";

import { useEffect, useRef, useState } from "react";
import type { FinHeadline, MarketQuote } from "@/lib/types";

const UP = "#5dff9e";
const DOWN = "#ff414e";
const POLL_MS = 30_000;
const NEWS_POLL_MS = 300_000;

// per-desk accent for the FIN NEWS source tag (kept subtle)
const SRC_COLOR: Record<string, string> = {
  MARKETS: "#00e5ff",
  FINANCE: "#5dff9e",
  BUSINESS: "#b14bff",
};

// compact relative time, e.g. "now" / "7m" / "3h" / "2d"
function ago(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// price precision: big numbers stay whole, sub-dollar gets more decimals
function fmtPrice(p: number): string {
  const a = Math.abs(p);
  const d = a >= 1000 ? 0 : a >= 10 ? 2 : a >= 1 ? 3 : 4;
  return p.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

// thin neon sparkline — colored by direction, kept low-key so the board reads calm
function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 58;
  const h = 18;
  const pad = 1.5;
  if (!data || data.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}

// live UTC clock in the panel sub-header (its own ticker = no board re-render)
function UtcClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 19));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="tabular-nums">{t} UTC</span>;
}

// FIN NEWS — recent financial headlines (free CNBC RSS via /api/fin-news).
// Clean two-line rows: desk tag + relative time, then the headline (opens in a
// new tab). Polls every 5 min while open.
function FinNews() {
  const [items, setItems] = useState<FinHeadline[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/fin-news", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: FinHeadline[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        /* keep last good list */
      }
    };
    run();
    const iv = setInterval(run, NEWS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="mt-2 border-t border-wv-border pt-2">
      <div className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-bold tracking-[0.22em] text-wv-muted">
        <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-magenta" />
        FIN NEWS
      </div>
      {items.map((h) => (
        <a
          key={h.id}
          href={h.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block px-3 py-1.5 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center justify-between text-[9.5px] tracking-[0.14em]">
            <span style={{ color: SRC_COLOR[h.source] ?? "var(--wv-cyan)" }}>
              {h.source}
            </span>
            <span className="tabular-nums text-wv-muted">{ago(h.time)}</span>
          </div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-wv-text/90 group-hover:text-wv-text">
            {h.title}
          </div>
        </a>
      ))}
    </div>
  );
}

/**
 * MARKETS — grouped ticker board (commodities · indices · crypto · FX), each row
 * a clean name / sparkline / price + change, followed by a FIN NEWS headline
 * feed. Real data via /api/markets (Yahoo Finance) + /api/fin-news (CNBC RSS),
 * both key-free. Polls only while this panel is mounted (i.e. open).
 */
export default function MarketsPanel() {
  const [items, setItems] = useState<MarketQuote[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const firstLoad = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/markets", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { items: MarketQuote[] };
        if (cancelled) return;
        setItems(data.items);
        setStatus(data.items.length ? "ok" : "error");
      } catch {
        if (!cancelled) setStatus((s) => (s === "ok" ? "ok" : "error"));
      } finally {
        firstLoad.current = false;
      }
    };
    run();
    const iv = setInterval(run, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  let lastGroup = "";

  return (
    <div className="pb-3">
      {/* sub-header: live status + UTC clock */}
      <div className="flex items-center justify-between border-b border-wv-border px-3 py-1.5 text-[10px] tracking-[0.18em] text-wv-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: status === "ok" ? UP : "var(--wv-amber)" }}
          />
          {status === "error" ? "FEED DOWN" : "LIVE"}
        </span>
        <UtcClock />
      </div>

      {status === "loading" && items.length === 0 ? (
        <div className="px-3 py-4 text-[10px] text-wv-muted">
          Acquiring market data…
        </div>
      ) : (
        items.map((q) => {
          const up = q.changePct >= 0;
          const color = up ? UP : DOWN;
          const header = q.group !== lastGroup ? ((lastGroup = q.group), q.group) : null;
          return (
            <div key={q.symbol}>
              {header && (
                <div className="px-3 pb-1 pt-3 text-[10px] font-bold tracking-[0.22em] text-wv-muted">
                  {header}
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-1.5 transition-colors hover:bg-white/[0.03]">
                <span className="truncate text-[12px] text-wv-text">{q.label}</span>
                <Spark data={q.spark} color={color} />
                <span className="flex w-[76px] flex-col items-end leading-tight">
                  <span className="text-[12px] font-semibold tabular-nums text-wv-text">
                    {fmtPrice(q.price)}
                  </span>
                  <span
                    className="text-[10.5px] tabular-nums"
                    style={{ color }}
                  >
                    {up ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(2)}%
                  </span>
                </span>
              </div>
            </div>
          );
        })
      )}

      <div className="px-3 pt-2 text-[8.5px] leading-relaxed text-wv-muted/70">
        Yahoo Finance · delayed quotes · refreshes every 30s
      </div>

      <FinNews />
    </div>
  );
}
