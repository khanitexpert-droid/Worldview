"use client";

import { useWorldView, type RightPanel } from "@/lib/store";
import IntelBody from "./IntelFeed";
import UserDataPanel from "./UserDataPanel";
import ToolsPanel from "./ToolsPanel";

const META: Record<RightPanel, { icon: string; label: string }> = {
  intel: { icon: "≣", label: "INTEL FEED" },
  userdata: { icon: "⤓", label: "ADD DATA" },
  tools: { icon: "⚒", label: "TOOLS" },
};

/**
 * Right-side overlay panel — the utility surfaces (Selected / Intel / My Data /
 * Tools / Data Layers) opened from the top bar. Anchored to the right so it
 * never collides with the left side panel. Driven by the store's rightPanel.
 */
export default function RightPanels({
  onAddFiles,
  onAddCogUrl,
  onZoomLayer,
  onScreenshot,
  onClearMeasure,
  onClearHighlight,
}: {
  onAddFiles: (files: File[]) => void;
  onAddCogUrl: (url: string) => void;
  onZoomLayer: (id: string) => void;
  onScreenshot: () => void;
  onClearMeasure: () => void;
  onClearHighlight: () => void;
}) {
  const open = useWorldView((s) => s.rightPanel);
  const setPanel = useWorldView((s) => s.setRightPanel);
  if (!open) return null;
  const m = META[open];

  return (
    <div
      key={open}
      className="wv-panel-in hud-panel corner-ticks fixed right-3 top-[116px] bottom-12 z-40 flex w-80 flex-col"
    >
      <div className="hud-panel-header flex items-center justify-between px-3 py-2">
        <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-wv-text">
          <span className="text-wv-magenta">{m.icon}</span>
          {m.label}
          {open === "intel" && (
            <span className="flex items-center gap-1 text-[9px] font-normal text-wv-magenta">
              <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-magenta" />
              STREAMING
            </span>
          )}
        </span>
        <button
          onClick={() => setPanel(null)}
          className="text-wv-muted transition-colors hover:text-wv-red"
          aria-label="close panel"
        >
          ✕
        </button>
      </div>

      <div className="wv-scroll flex-1 overflow-y-auto">
        {open === "intel" && <IntelBody />}
        {open === "userdata" && (
          <UserDataPanel
            onAddFiles={onAddFiles}
            onAddCogUrl={onAddCogUrl}
            onZoom={onZoomLayer}
          />
        )}
        {open === "tools" && (
          <ToolsPanel
            onScreenshot={onScreenshot}
            onClearMeasure={onClearMeasure}
            onClearHighlight={onClearHighlight}
          />
        )}
      </div>
    </div>
  );
}
