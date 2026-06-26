"use client";

import { useWorldView } from "@/lib/store";
import EntityBody from "./EntityDetail";

/**
 * Compact selected-entity card (deltasweep-style) — a small floating popup, not
 * a full-height panel. Shown only when something is selected; reuses EntityBody
 * for the header/title/photo/rows. Anchored to the RIGHT edge (clear of the left
 * side panel + the INFRA/layer dropdowns); shifts left of an open right panel.
 */
export default function SelectedPopup({
  onFlyTo,
}: {
  onFlyTo: (lon: number, lat: number, h?: number) => void;
}) {
  const selected = useWorldView((s) => s.selected);
  const setSelected = useWorldView((s) => s.setSelected);
  const rightPanel = useWorldView((s) => s.rightPanel);

  if (!selected) return null;

  return (
    <div
      className="wv-panel-in hud-panel corner-ticks fixed bottom-16 z-[45] flex max-h-[72vh] w-[300px] flex-col"
      // bottom-right corner (deltasweep-style), above the status bar; when a right
      // panel (w-80 = 320px) is open, sit just to its left so they never overlap.
      style={{ right: rightPanel ? 344 : 12 }}
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
