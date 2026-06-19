"use client";

import { useWorldView } from "@/lib/store";

const TONE: Record<string, string> = {
  info: "text-wv-text",
  ok: "text-wv-cyan",
  warn: "text-wv-amber",
  alert: "text-wv-red",
};

/**
 * Live telemetry log — rendered inside the right rail's side panel
 * (content only; the rail provides the scroll container + header).
 */
export default function IntelBody() {
  const intel = useWorldView((s) => s.intel);

  return (
    <div className="px-3 py-2 text-[10px] leading-relaxed">
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
  );
}
