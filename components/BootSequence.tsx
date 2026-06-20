"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Clean, professional loading splash. Shows the brand + a progress bar and
 * auto-enters as soon as the globe is ready (no key press, no fake boot log),
 * then fades smoothly into the map. `ready` is driven by the globe's init.
 */
export default function BootSequence({
  ready,
  onDone,
}: {
  ready: boolean;
  onDone: () => void;
}) {
  const [pct, setPct] = useState(12);
  const [leaving, setLeaving] = useState(false);
  const start = useRef(0);
  const done = useRef(false);
  if (start.current === 0) start.current = Date.now();

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setPct(100);
    setLeaving(true);
    setTimeout(onDone, 550); // matches the fade-out duration
  }, [onDone]);

  // indeterminate creep toward ~92% while the globe warms up
  useEffect(() => {
    const id = setInterval(
      () => setPct((p) => (p < 92 ? p + (92 - p) * 0.06 + 0.4 : p)),
      100
    );
    return () => clearInterval(id);
  }, []);

  // complete shortly after the globe reports ready (keeping a brief minimum so
  // the brand registers); a hard fallback so we never hang on a slow load.
  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, 1100 - (Date.now() - start.current));
    const t = setTimeout(finish, wait);
    return () => clearTimeout(t);
  }, [ready, finish]);
  useEffect(() => {
    const t = setTimeout(finish, 7000);
    return () => clearTimeout(t);
  }, [finish]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-wv-black transition-opacity duration-500 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-6 px-8 text-center">
        <div>
          <div className="text-[32px] font-bold leading-none tracking-[0.16em]">
            <span className="text-wv-cyan">WORLD</span>
            <span className="text-wv-magenta">VIEW</span>
          </div>
          <div className="mt-3 text-[10px] tracking-[0.34em] text-wv-muted">
            LIVE GLOBAL ACTIVITY MAP
          </div>
        </div>

        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-wv-cyan to-wv-magenta transition-[width] duration-200 ease-out"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <div className="text-[10px] tracking-[0.3em] text-wv-muted">
          {pct < 100 ? "Loading…" : "Ready"}
        </div>
      </div>
    </div>
  );
}
