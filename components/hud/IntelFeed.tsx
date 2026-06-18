"use client";

import { useWorldView } from "@/lib/store";

const TONE: Record<string, string> = {
  info: "text-wv-text",
  ok: "text-wv-cyan",
  warn: "text-wv-amber",
  alert: "text-wv-red",
};

export default function IntelFeed({
  onFocus,
}: {
  onFocus: (lon: number, lat: number, h?: number) => void;
}) {
  const intel = useWorldView((s) => s.intel);
  void onFocus; // reserved for click-to-focus on geotagged intel

  return (
    <div className="hud-panel corner-ticks fixed bottom-3 right-3 z-40 w-80">
      <div className="hud-panel-header flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-bold tracking-[0.2em] text-wv-text">
          INTEL FEED
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-wv-magenta">
          <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-magenta" />
          STREAMING
        </span>
      </div>

      <div className="wv-scroll h-40 overflow-y-auto px-3 py-2 text-[10px] leading-relaxed">
        {intel.length === 0 ? (
          <div className="text-wv-muted">Awaiting telemetry…</div>
        ) : (
          intel.map((line) => (
            <div key={line.id} className="flex gap-2">
              <span className="shrink-0 text-wv-muted">{line.time}</span>
              <span className={TONE[line.tone] ?? "text-wv-text"}>
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
