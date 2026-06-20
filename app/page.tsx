"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import BootSequence from "@/components/BootSequence";

// Cesium touches window/WebGL — must be client-only.
const WorldView = dynamic(() => import("@/components/WorldView"), {
  ssr: false,
});

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);

  return (
    <main className="h-full w-full">
      {/* mount the globe behind the splash so it's warm by the time it lifts */}
      <WorldView onReady={() => setGlobeReady(true)} />
      {!booted && (
        <BootSequence ready={globeReady} onDone={() => setBooted(true)} />
      )}
    </main>
  );
}
