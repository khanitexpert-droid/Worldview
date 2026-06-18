"use client";

// One-shot CRT power-on flash over the globe. Self-removes when the
// animation ends.
export default function CrtPowerOn({ onDone }: { onDone: () => void }) {
  return <div className="crt-on" onAnimationEnd={onDone} />;
}
