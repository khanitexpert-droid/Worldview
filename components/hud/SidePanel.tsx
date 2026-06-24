"use client";

import { useWorldView, type SideTab } from "@/lib/store";
import MarketsPanel from "./MarketsPanel";
import NewsPanel from "./NewsPanel";
import ActivityPanel from "./ActivityPanel";
import CaspianPanel from "./CaspianPanel";
import MissilesPanel from "./MissilesPanel";

const TABS: { id: SideTab; label: string }[] = [
  { id: "caspian", label: "CASPIAN" },
  { id: "activity", label: "ACTIVITY" },
  { id: "news", label: "NEWS" },
  { id: "markets", label: "MARKETS" },
  { id: "missiles", label: "MISSILES" },
];

/**
 * Left side panel (deltasweep-style) — the main intel surface. Horizontal tabs
 * across the top (Caspian · Activity · News · Markets); open by default, with a
 * ‹ arrow to hide it completely (a › edge tab reopens). Only the active tab's
 * content is mounted, so e.g. the NEWS live video stops when you switch away.
 */
export default function SidePanel({
  onFlyTo,
}: {
  onFlyTo?: (lon: number, lat: number, h?: number) => void;
}) {
  const tab = useWorldView((s) => s.sideTab);
  const setTab = useWorldView((s) => s.setSideTab);
  const open = useWorldView((s) => s.sideOpen);
  const setOpen = useWorldView((s) => s.setSideOpen);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open panel"
        aria-label="Open panel"
        className="hud-panel fixed left-0 top-1/2 z-40 -translate-y-1/2 border-l-0 px-1.5 py-5 text-wv-cyan transition-colors hover:text-wv-magenta"
      >
        ›
      </button>
    );
  }

  return (
    <aside className="wv-panel-in hud-panel fixed left-0 top-14 bottom-0 z-40 flex w-[360px] flex-col border-l-0 border-b-0">
      {/* tab row */}
      <div className="flex items-stretch border-b border-wv-border">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex-1 px-1 py-2.5 text-[12px] font-bold tracking-[0.04em]"
              style={{ color: on ? "#00e5ff" : "#ff414e" }}
            >
              {t.label}
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{
                  background: on ? "#00e5ff" : "transparent",
                  boxShadow: on ? "0 0 8px #00e5ff" : "none",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* active tab content */}
      <div className="wv-scroll flex-1 overflow-y-auto">
        {tab === "caspian" && <CaspianPanel />}
        {tab === "activity" && <ActivityPanel />}
        {tab === "news" && <NewsPanel />}
        {tab === "markets" && <MarketsPanel />}
        {tab === "missiles" && <MissilesPanel onFlyTo={onFlyTo} />}
      </div>

      {/* collapse tab — centered on the panel's right edge (deltasweep-style) */}
      <button
        onClick={() => setOpen(false)}
        title="Hide panel"
        aria-label="Hide panel"
        className="hud-panel absolute right-0 top-1/2 z-40 -translate-y-1/2 translate-x-full border-l-0 px-1.5 py-5 text-wv-cyan transition-colors hover:text-wv-magenta"
      >
        ‹
      </button>
    </aside>
  );
}
