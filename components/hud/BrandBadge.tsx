"use client";

import { useEffect, useState } from "react";

/**
 * WORLDVIEW brand mark + running UTC clock, parked in the bottom-right corner
 * (smaller than the old top header; no "tactical intelligence system" subtitle).
 */
export default function BrandBadge() {
  const [now, setNow] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19) + " UTC");
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 select-none text-right">
      <div className="flex items-center justify-end gap-2">
        <div className="text-wv-magenta glow-magenta text-sm font-bold tracking-[0.22em] leading-none">
          WORLD<span className="text-wv-cyan glow-cyan">VIEW</span>
        </div>
        <span className="flex items-center gap-1 text-[9px] text-wv-cyan">
          <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-cyan box-glow-cyan" />
          LIVE
        </span>
      </div>
      <div className="mt-0.5 text-[10px] tracking-widest text-wv-cyan glow-cyan">
        {now}
      </div>
    </div>
  );
}
