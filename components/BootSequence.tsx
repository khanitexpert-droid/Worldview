"use client";

import { useEffect, useRef, useState } from "react";

// label + dotted-leader + OK reveal
const BOOT_LINES: { text: string; tone?: "magenta" | "cyan" }[] = [
  { text: "ESTABLISHING SECURE UPLINK" },
  { text: "INITIALISING CESIUM 3D RENDER CORE" },
  { text: "MOUNTING ORBITAL IMAGERY TILES" },
  { text: "LINKING GLOBAL ADS-B NETWORK" },
  { text: "PROPAGATING CELESTRAK TLE CATALOG" },
  { text: "TAPPING USGS SEISMIC BACKBONE" },
  { text: "SYNCING AIS MARITIME RELAY" },
  { text: "INDEXING GLOBAL CCTV GRID" },
  { text: "COMPILING POST-FX SHADERS" },
  { text: "CALIBRATING TACTICAL HUD OVERLAY" },
];

const DOTS = (s: string) => s + " " + ".".repeat(Math.max(2, 40 - s.length));

type Phase = "booting" | "ready" | "entering";

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(0);
  const [phase, setPhase] = useState<Phase>("booting");
  const [sid, setSid] = useState("--------");
  const [clock, setClock] = useState({ base: "----------------", ms: "---" });
  const armed = useRef(false);

  // client-only session id (avoids SSR hydration mismatch)
  useEffect(() => {
    setSid(
      Array.from(
        { length: 8 },
        () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]
      ).join("")
    );
  }, []);

  // live UTC clock — ms races every frame like a stopwatch counter
  useEffect(() => {
    let raf = 0;
    const p = (n: number, l = 2) => String(n).padStart(l, "0");
    const tickClock = () => {
      const d = new Date();
      setClock({
        base: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(
          d.getUTCDate()
        )} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
        ms: p(d.getUTCMilliseconds(), 3),
      });
      raf = requestAnimationFrame(tickClock);
    };
    raf = requestAnimationFrame(tickClock);
    return () => cancelAnimationFrame(raf);
  }, []);

  // reveal lines one by one, then arm the "press any key" gate
  useEffect(() => {
    let i = 0;
    const tick = () => {
      i++;
      setVisible(i);
      if (i < BOOT_LINES.length) {
        setTimeout(tick, 1000 + Math.random() * 360);
      } else {
        setTimeout(() => setPhase("ready"), 450);
      }
    };
    const start = setTimeout(tick, 400);
    return () => clearTimeout(start);
  }, []);

  // wait for any key / click / tap once ready
  useEffect(() => {
    if (phase !== "ready") return;
    const enter = () => {
      if (armed.current) return;
      armed.current = true;
      setPhase("entering");
      // matches the crt-off animation duration
      setTimeout(onDone, 600);
    };
    window.addEventListener("keydown", enter);
    window.addEventListener("pointerdown", enter);
    return () => {
      window.removeEventListener("keydown", enter);
      window.removeEventListener("pointerdown", enter);
    };
  }, [phase, onDone]);

  const allDone = visible >= BOOT_LINES.length;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-wv-black ${
        phase === "entering" ? "crt-off" : "opacity-100"
      }`}
    >
      <div className="w-full max-w-2xl px-8 font-mono text-[13px] leading-relaxed">
        {/* header */}
        <div className="text-wv-cyan glow-cyan text-base font-bold tracking-[0.18em]">
          WORLD<span className="text-wv-magenta glow-magenta">VIEW</span>{" "}
          TACTICAL INTELLIGENCE SYSTEM
        </div>
        <div className="mt-1 flex justify-between text-[10px] tracking-widest text-wv-muted">
          <span>KERNEL v1.0.0 · SESSION {sid}</span>
          <span className="tabular-nums">
            {clock.base}.
            <span className="text-wv-cyan">{clock.ms}</span>Z
          </span>
        </div>
        <div className="my-3 h-px w-full bg-gradient-to-r from-wv-magenta/60 via-wv-border to-transparent" />

        {/* boot lines */}
        {BOOT_LINES.slice(0, visible).map((l, idx) => (
          <div key={idx} className="text-wv-green">
            <span className="text-wv-muted">{DOTS(l.text)}</span>
            <span className="text-wv-green glow-cyan"> OK</span>
            {idx === visible - 1 && !allDone && <span className="wv-cursor" />}
          </div>
        ))}

        {/* status + gate */}
        {allDone && (
          <>
            <div className="mt-4 font-bold tracking-[0.15em] text-wv-green glow-cyan">
              ALL SYSTEMS NOMINAL
            </div>
            <div className="text-wv-magenta glow-magenta text-[11px] tracking-[0.2em]">
              CLEARANCE: OMEGA // ACCESS GRANTED
            </div>

            {phase === "ready" && (
              <div className="mt-5">
                <span className="wv-prompt text-wv-cyan glow-cyan font-bold tracking-[0.2em]">
                  ▶ PRESS ANY KEY TO ENTER
                </span>
                <div className="mt-1 text-[9px] tracking-[0.3em] text-wv-muted">
                  [ KEYBOARD · CLICK · TAP ]
                </div>
              </div>
            )}

            {phase === "entering" && (
              <div className="mt-5">
                <span className="wv-entering text-wv-magenta glow-magenta font-bold tracking-[0.2em]">
                  ▶ ENTERING SYSTEM_
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
