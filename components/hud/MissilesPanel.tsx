"use client";

import { useWorldView } from "@/lib/store";
import { MISSILES, MISSILE_OPERATORS } from "@/lib/missiles";

const STATUS_COLOR: Record<string, string> = {
  OPERATIONAL: "#5dff9e",
  RETIRED: "#6c5b8c",
  REPORTED: "#ffb347",
  DEVELOPMENT: "#ffb347",
};

/**
 * MISSILES — curated reference catalog (deltasweep parity). Operator arsenals
 * with class/status/payload/range; names colored by operator. Clicking a missile
 * frames its range ring on the globe (rings drawn by WorldView while this tab is
 * open). Real open-source reference data, not a live feed.
 */
export default function MissilesPanel({
  onFlyTo,
}: {
  onFlyTo?: (lon: number, lat: number, h?: number) => void;
}) {
  const ringIds = useWorldView((s) => s.missileRingIds);
  const toggleRing = useWorldView((s) => s.toggleMissileRing);
  let lastOp = "";

  return (
    <div className="pb-3">
      <div className="flex items-center justify-between border-b border-wv-border px-3 py-1.5 text-[9px] font-bold tracking-[0.2em] text-wv-muted">
        <span>RANGE REFERENCE</span>
        <span className="font-normal text-wv-muted/70">tap to toggle ring</span>
      </div>

      {MISSILES.map((m) => {
        const op = MISSILE_OPERATORS[m.operator];
        const opColor = op?.color ?? "var(--wv-text)";
        const on = ringIds.includes(m.id);
        const header = m.operator !== lastOp ? ((lastOp = m.operator), m.operator) : null;
        return (
          <div key={m.id}>
            {header && (
              <div
                className="px-3 pb-1 pt-3 text-[9px] font-bold tracking-[0.22em]"
                style={{ color: opColor }}
              >
                {header.toUpperCase()}
              </div>
            )}
            <button
              onClick={() => {
                if (!on && op)
                  onFlyTo?.(
                    op.origin[0],
                    op.origin[1],
                    Math.max(m.rangeKm * 1000 * 2.2, 1_500_000)
                  );
                toggleRing(m.id);
              }}
              className="block w-full border-b border-wv-border/40 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
              style={{
                borderLeft: `2px solid ${on ? opColor : "transparent"}`,
                background: on ? "rgba(255,255,255,0.05)" : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className="flex items-center gap-1.5 text-[12px] font-bold"
                    style={{ color: opColor }}
                  >
                    {on && (
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: opColor, boxShadow: `0 0 6px ${opColor}` }}
                      />
                    )}
                    {m.name}
                  </div>
                  <div className="mt-0.5 text-[9px] text-wv-muted">
                    {m.category} ·{" "}
                    <span style={{ color: STATUS_COLOR[m.status] }}>{m.status}</span>
                    {m.payloadKg ? ` · ${m.payloadKg} kg` : ""}
                  </div>
                  {m.note && (
                    <div className="mt-0.5 text-[9px] leading-relaxed text-wv-muted/80">
                      {m.note}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right leading-none">
                  <div
                    className="text-[15px] font-bold tabular-nums"
                    style={{ color: opColor }}
                  >
                    {m.rangeKm.toLocaleString()}
                  </div>
                  <div className="text-[8px] tracking-widest text-wv-muted">KM</div>
                </div>
              </div>
            </button>
          </div>
        );
      })}

      <div className="px-3 pt-2 text-[8.5px] leading-relaxed text-wv-muted/70">
        Curated open-source reference · tap a missile to toggle its range ring · tap again to hide
      </div>
    </div>
  );
}
