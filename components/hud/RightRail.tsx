"use client";

import { useWorldView, type RightPanel } from "@/lib/store";
import { LAYERS } from "@/lib/layers";
import LayersBody from "./DataLayersPanel";
import IntelBody from "./IntelFeed";
import EntityBody from "./EntityDetail";
import UserDataPanel from "./UserDataPanel";
import ToolsPanel from "./ToolsPanel";

interface Tab {
  id: RightPanel;
  icon: string;
  label: string;
}

const TABS: Tab[] = [
  { id: "selected", icon: "⌖", label: "SELECTED" },
  { id: "intel", icon: "≣", label: "INTEL FEED" },
  { id: "layers", icon: "▦", label: "DATA LAYERS" },
  { id: "userdata", icon: "⤓", label: "MY DATA" },
  { id: "tools", icon: "⚒", label: "TOOLS" },
];

export default function RightRail({
  onFlyTo,
  onAddFiles,
  onAddCogUrl,
  onZoomLayer,
  onScreenshot,
  onClearMeasure,
  onClearHighlight,
}: {
  onFlyTo: (lon: number, lat: number, h?: number) => void;
  onAddFiles: (files: File[]) => void;
  onAddCogUrl: (url: string) => void;
  onZoomLayer: (id: string) => void;
  onScreenshot: () => void;
  onClearMeasure: () => void;
  onClearHighlight: () => void;
}) {
  const open = useWorldView((s) => s.rightPanel);
  const toggle = useWorldView((s) => s.toggleRightPanel);
  const setPanel = useWorldView((s) => s.setRightPanel);
  const selected = useWorldView((s) => s.selected);
  const layers = useWorldView((s) => s.layers);
  const intelCount = useWorldView((s) => s.intel.length);
  const userLayerCount = useWorldView((s) => s.userLayers.length);
  const activeTool = useWorldView((s) => s.activeTool);

  const activeLayers = LAYERS.filter((l) => layers[l.id]).length;
  const active = TABS.find((t) => t.id === open);

  // small status badge shown on each rail icon
  const badge = (id: RightPanel) => {
    if (id === "selected")
      return selected ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-wv-cyan box-glow-cyan" />
      ) : null;
    if (id === "intel")
      return intelCount > 0 ? (
        <span className="wv-live-dot absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-wv-magenta" />
      ) : null;
    if (id === "layers")
      return (
        <span className="absolute -right-1 -top-1 min-w-[14px] rounded-full border border-wv-border bg-wv-darker px-1 text-center text-[8px] font-bold leading-[13px] text-wv-cyan">
          {activeLayers}
        </span>
      );
    if (id === "userdata")
      return userLayerCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-[14px] rounded-full border border-wv-border bg-wv-darker px-1 text-center text-[8px] font-bold leading-[13px] text-wv-amber">
          {userLayerCount}
        </span>
      ) : null;
    if (id === "tools")
      return activeTool ? (
        <span
          className="wv-live-dot absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
          style={{ background: "#aaff00", boxShadow: "0 0 8px #aaff00" }}
        />
      ) : null;
    return null;
  };

  return (
    <>
      {/* ---- sliding context panel (opens to the right of the rail) ---- */}
      {active && (
        <div
          key={active.id}
          className="wv-panel-in hud-panel corner-ticks fixed left-[52px] top-16 bottom-12 z-40 flex w-80 flex-col"
        >
          <div className="hud-panel-header flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-wv-text">
              <span className="text-wv-magenta">{active.icon}</span>
              {active.label}
              {active.id === "intel" && (
                <span className="flex items-center gap-1 text-[9px] font-normal text-wv-magenta">
                  <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-magenta" />
                  STREAMING
                </span>
              )}
            </span>
            <button
              onClick={() => setPanel(null)}
              className="text-wv-muted transition-colors hover:text-wv-red"
              aria-label="collapse panel"
            >
              ✕
            </button>
          </div>

          <div className="wv-scroll flex-1 overflow-y-auto">
            {active.id === "selected" && <EntityBody onFlyTo={onFlyTo} />}
            {active.id === "intel" && <IntelBody />}
            {active.id === "layers" && <LayersBody />}
            {active.id === "userdata" && (
              <UserDataPanel
                onAddFiles={onAddFiles}
                onAddCogUrl={onAddCogUrl}
                onZoom={onZoomLayer}
              />
            )}
            {active.id === "tools" && (
              <ToolsPanel
                onScreenshot={onScreenshot}
                onClearMeasure={onClearMeasure}
                onClearHighlight={onClearHighlight}
              />
            )}
          </div>
        </div>
      )}

      {/* ---- the icon rail (flush to the left edge) ---- */}
      <nav className="hud-panel fixed left-0 top-0 z-40 flex h-full w-[52px] flex-col items-center justify-center gap-1.5 border-y-0 border-l-0 py-3">
        {TABS.map((t) => {
          const isOpen = open === t.id;
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              title={t.label}
              aria-label={t.label}
              aria-pressed={isOpen}
              className={`group relative flex h-11 w-11 items-center justify-center text-lg transition-all ${
                isOpen
                  ? "text-wv-magenta box-glow-magenta bg-white/[0.04]"
                  : "text-wv-muted hover:text-wv-cyan"
              }`}
            >
              {/* active accent bar on the right edge */}
              <span
                className={`absolute right-0 top-1/2 h-6 w-[2px] -translate-y-1/2 transition-all ${
                  isOpen ? "bg-wv-magenta box-glow-magenta" : "bg-transparent"
                }`}
              />
              <span className={isOpen ? "glow-magenta" : ""}>{t.icon}</span>
              {badge(t.id)}
            </button>
          );
        })}
      </nav>
    </>
  );
}
