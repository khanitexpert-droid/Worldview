"use client";

import { useWorldView } from "@/lib/store";

/** A small toggle pill used throughout the Hormuz filter panel. */
function Pill({
  on,
  onClick,
  children,
  color = "#ffb347",
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-sm border px-2 py-1 text-[10px] font-bold tracking-[0.08em] transition-colors"
      style={{
        borderColor: on ? color : "var(--wv-border)",
        color: on ? color : "var(--wv-muted)",
        background: on ? `${color}1a` : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 text-[9px] font-bold tracking-[0.2em] text-wv-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Strait of Hormuz filter panel (deltasweep-style) — map-layer toggles +
 * vessel filters. Shown only while the WORLD EVENTS · Strait of Hormuz layer is
 * on; closing it (X) turns the layer off.
 */
export default function HormuzPanel() {
  const on = useWorldView((s) => s.layers.hormuz);
  const h = useWorldView((s) => s.hormuz);
  const set = useWorldView((s) => s.setHormuz);
  const reset = useWorldView((s) => s.resetHormuz);
  const stats = useWorldView((s) => s.hormuzStats);
  const toggleLayer = useWorldView((s) => s.toggleLayer);
  if (!on) return null;

  const AMBER = "#ffb347";
  return (
    <div className="wv-panel-in hud-panel wv-scroll fixed left-2 top-16 z-[46] max-h-[80vh] w-[268px] overflow-y-auto p-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-bold tracking-[0.18em] text-wv-text">
            # STRAIT OF HORMUZ
          </div>
          <div className="text-[10px] text-wv-muted">Live crossings — filter the map</div>
        </div>
        <button
          onClick={() => toggleLayer("hormuz")}
          aria-label="close"
          className="text-wv-muted transition-colors hover:text-wv-red"
        >
          ✕
        </button>
      </div>

      <div className="mt-2">
        <span className="text-[22px] font-bold tabular-nums text-wv-text">
          {stats ? stats.shown : 0}
        </span>
        <span className="ml-1 text-[10px] text-wv-muted">
          of {stats ? stats.total : 0} vessels shown
        </span>
      </div>
      <div className="text-[10px]" style={{ color: AMBER }}>
        ⚠ {stats ? stats.sanctioned : 0} sanctioned ·{" "}
        <span className="text-wv-red">{stats ? stats.aisGap : 0} AIS gap</span> ·{" "}
        <span className="text-wv-muted">
          {stats ? stats.inb : 0} in / {stats ? stats.outb : 0} out
        </span>
      </div>

      <Section label="MAP LAYERS">
        <Pill on={h.crossings} onClick={() => set({ crossings: !h.crossings })}>⛴ Crossings</Pill>
        <Pill on={h.blockade} onClick={() => set({ blockade: !h.blockade })} color="#e0294a">▦ Blockade Zone</Pill>
        <Pill on={h.incidents} onClick={() => set({ incidents: !h.incidents })} color="#ff5630">⚠ Incidents</Pill>
        <Pill on={h.vulnerability} onClick={() => set({ vulnerability: !h.vulnerability })} color="#5dff9e">◍ Vulnerability</Pill>
      </Section>

      <Section label="FLAGS">
        <Pill on={h.sanctionedOnly} onClick={() => set({ sanctionedOnly: !h.sanctionedOnly })} color="#e0294a">⚠ Sanctioned only</Pill>
        <Pill on={h.aisGap} onClick={() => set({ aisGap: !h.aisGap })}>AIS reporting gap</Pill>
      </Section>

      <Section label="DIRECTION">
        {(["all", "in", "out"] as const).map((d) => (
          <Pill key={d} on={h.direction === d} onClick={() => set({ direction: d })} color="#00e5ff">
            {d === "all" ? "All" : d === "in" ? "Inbound" : "Outbound"}
          </Pill>
        ))}
      </Section>

      <Section label="RISK TIER">
        <Pill on={h.riskHigh} onClick={() => set({ riskHigh: !h.riskHigh })} color="#e0294a">High</Pill>
        <Pill on={h.riskLow} onClick={() => set({ riskLow: !h.riskLow })} color="#5dff9e">Low</Pill>
      </Section>

      <Section label="SHIP TYPE">
        <Pill on={h.cargo} onClick={() => set({ cargo: !h.cargo })} color="#5dff9e">Cargo</Pill>
        <Pill on={h.tanker} onClick={() => set({ tanker: !h.tanker })} color="#ffb347">Tanker</Pill>
      </Section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={reset}
          className="border border-wv-border py-1.5 text-center text-[10px] font-bold tracking-[0.16em] text-wv-text transition-colors hover:border-wv-cyan hover:text-wv-cyan"
        >
          Reset
        </button>
        <button
          onClick={() => toggleLayer("hormuz")}
          className="border py-1.5 text-center text-[10px] font-bold tracking-[0.16em] transition-colors"
          style={{ borderColor: AMBER, color: AMBER, background: `${AMBER}1a` }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
