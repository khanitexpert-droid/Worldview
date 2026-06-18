"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import BootSequence from "@/components/BootSequence";
import CrtPowerOn from "@/components/CrtPowerOn";

// Cesium touches window/WebGL — must be client-only.
const WorldView = dynamic(() => import("@/components/WorldView"), {
  ssr: false,
});

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [powering, setPowering] = useState(false);

  return (
    <main className="h-full w-full">
      {/* mount the globe behind the boot screen so it's warm by the time it lifts */}
      <WorldView />
      {powering && <CrtPowerOn onDone={() => setPowering(false)} />}
      {!booted && (
        <BootSequence
          onDone={() => {
            setBooted(true);
            setPowering(true);
          }}
        />
      )}
    </main>
  );
}
