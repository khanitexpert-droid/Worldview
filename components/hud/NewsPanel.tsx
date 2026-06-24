"use client";

import { useEffect, useState } from "react";
import type { PredictionMarket } from "@/lib/types";

const PRED_POLL_MS = 300_000;

// 24/7 English news livestreams (resolved to their current live video by
// /api/news-tv). Keys match the route's channel map.
const CHANNELS: { key: string; label: string }[] = [
  { key: "aljazeera", label: "Al Jazeera" },
  { key: "france24", label: "France 24" },
  { key: "skynews", label: "Sky News" },
  { key: "dw", label: "DW News" },
  { key: "euronews", label: "Euronews" },
  { key: "trtworld", label: "TRT World" },
  { key: "i24news", label: "i24NEWS" },
  { key: "abcnews", label: "ABC News" },
];

function fmtVol(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(Math.round(n));
}

// ---- LIVE TV: channel chips + the selected channel's YouTube live embed ----
function LiveTv() {
  const [sel, setSel] = useState(CHANNELS[0].key);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "off">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setVideoId(null);
    (async () => {
      try {
        const res = await fetch(`/api/news-tv?channel=${sel}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { videoId: string | null };
        if (cancelled) return;
        setVideoId(data.videoId);
        setState(data.videoId ? "ok" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sel]);

  const label = CHANNELS.find((c) => c.key === sel)?.label ?? "";

  return (
    <div className="px-3 pt-2">
      <div className="mb-1.5 text-[9px] font-bold tracking-[0.22em] text-wv-muted">
        LIVE TV
      </div>

      {/* channel chips */}
      <div className="mb-2 flex flex-wrap gap-1">
        {CHANNELS.map((c) => {
          const on = c.key === sel;
          return (
            <button
              key={c.key}
              onClick={() => setSel(c.key)}
              className="border px-1.5 py-1 text-[9px] font-semibold tracking-wide transition-colors"
              style={{
                borderColor: on ? "var(--wv-cyan)" : "var(--wv-border)",
                color: on ? "var(--wv-cyan)" : "var(--wv-muted)",
                background: on ? "rgba(0,229,255,0.08)" : "transparent",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* 16:9 player */}
      <div className="relative aspect-video w-full overflow-hidden border border-wv-border bg-wv-darker">
        {state === "ok" && videoId ? (
          <iframe
            key={videoId}
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`}
            title={`${label} live`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-wv-muted">
            {state === "loading" ? (
              <span className="wv-live-dot">Tuning {label}…</span>
            ) : (
              <span>{label} — no live stream right now</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between text-[9px]">
        <span className="flex items-center gap-1.5 text-wv-muted">
          <span
            className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: state === "ok" ? "#ff414e" : "var(--wv-muted)" }}
          />
          {state === "ok" ? `NOW · ${label} LIVE` : label}
        </span>
        {videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tracking-wide text-wv-cyan hover:underline"
          >
            OPEN IN YOUTUBE ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ---- PREDICTION MARKETS: real-money odds (Kalshi) as clean probability bars ----
function Predictions() {
  const [items, setItems] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/predictions", { cache: "no-store" });
        const data = (await res.json()) as { items: PredictionMarket[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        /* keep last good list */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const iv = setInterval(run, PRED_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="mt-3 border-t border-wv-border pt-2">
      <div className="mb-1 flex items-center gap-1.5 px-3 text-[9px] font-bold tracking-[0.22em] text-wv-muted">
        <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-violet" />
        PREDICTION MARKETS
      </div>

      {loading && !items.length ? (
        <div className="px-3 py-3 text-[10px] text-wv-muted">Loading odds…</div>
      ) : (
        items.map((m) => {
          const pct = Math.round(m.prob * 100);
          return (
            <div key={m.id} className="px-3 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10.5px] leading-snug text-wv-text/90" title={m.title}>
                  {m.title}
                </span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-wv-cyan">
                  {pct}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-wv-border/40">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: "var(--wv-cyan)" }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[8.5px] tracking-wide text-wv-muted">
                <span>
                  {m.outcome ? `Leading · ${m.outcome}` : m.category}
                </span>
                <span className="tabular-nums">VOL {fmtVol(m.volume)}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * NEWS — live TV channel embeds (current YouTube livestreams) + real-money
 * prediction-market odds (Kalshi). Both key-free. deltasweep parity, calmer
 * layout. Polls only while this panel is mounted (open).
 */
export default function NewsPanel() {
  return (
    <div className="pb-3">
      <LiveTv />
      <Predictions />
      <div className="px-3 pt-3 text-[8.5px] leading-relaxed text-wv-muted/70">
        Live TV · YouTube · Odds · Kalshi (real-money)
      </div>
    </div>
  );
}
