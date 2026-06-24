"use client";

import { useWorldView } from "@/lib/store";
import EntityBody from "./EntityDetail";

/**
 * Compact selected-entity card (deltasweep-style) — a small floating popup, not
 * a full-height panel. Shown only when something is selected; reuses EntityBody
 * for the header/title/photo/rows. Sits just right of the left side panel.
 */
export default function SelectedPopup({
  onFlyTo,
}: {
  onFlyTo: (lon: number, lat: number, h?: number) => void;
}) {
  const selected = useWorldView((s) => s.selected);
  const setSelected = useWorldView((s) => s.setSelected);
  const sideOpen = useWorldView((s) => s.sideOpen);

  if (!selected) return null;

  return (
    <div
      className="wv-panel-in hud-panel corner-ticks fixed top-16 z-[45] flex max-h-[78vh] w-[296px] flex-col"
      style={{ left: sideOpen ? 376 : 12 }}
    >
      <button
        onClick={() => setSelected(null)}
        aria-label="close"
        className="absolute right-2 top-2 z-10 text-wv-muted transition-colors hover:text-wv-red"
      >
        ✕
      </button>
      <div className="wv-scroll overflow-y-auto">
        <EntityBody onFlyTo={onFlyTo} />
      </div>
    </div>
  );
}
