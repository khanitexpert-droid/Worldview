"use client";

import { useEffect, useState } from "react";

export default function TopBar() {
  const [now, setNow] = useState("--:--:--");
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toISOString().slice(11, 19) + " UTC");
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="pointer-events-none fixed top-3 left-[64px] z-40 select-none">
      <div className="flex items-center gap-3">
        <div className="text-wv-magenta glow-magenta text-xl font-bold tracking-[0.25em] leading-none">
          WORLD<span className="text-wv-cyan glow-cyan">VIEW</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-wv-cyan">
          <span className="wv-live-dot inline-block h-1.5 w-1.5 rounded-full bg-wv-cyan box-glow-cyan" />
          LIVE
        </span>
      </div>
      <div className="mt-1 text-[10px] tracking-[0.3em] text-wv-muted">
        TACTICAL INTELLIGENCE SYSTEM
      </div>
      <div className="mt-0.5 text-[10px] tracking-widest text-wv-violet/80">
        {now}
      </div>
    </div>
  );
}
