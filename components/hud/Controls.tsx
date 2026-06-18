"use client";

export default function Controls({
  onReset,
  onLocate,
}: {
  onReset: () => void;
  onLocate: () => void;
}) {
  return (
    <div className="fixed top-3 right-3 z-40 flex flex-col items-end gap-1.5">
      <button
        onClick={onReset}
        className="hud-panel px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-wv-text transition-colors hover:text-wv-magenta hover:box-glow-magenta"
      >
        ⟲ RESET VIEW
      </button>
      <button
        onClick={onLocate}
        className="hud-panel px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-wv-text transition-colors hover:text-wv-cyan hover:box-glow-cyan"
      >
        ⌖ LOCATE ME
      </button>
    </div>
  );
}
