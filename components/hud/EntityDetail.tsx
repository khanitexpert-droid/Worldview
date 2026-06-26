"use client";

import { useEffect, useState } from "react";
import { useWorldView } from "@/lib/store";
import { LAYER_BY_ID } from "@/lib/layers";
import type { FeedEntity } from "@/lib/types";
import { countryFlag } from "@/lib/countryFlags";
import FlightExtras from "./FlightExtras";
import VesselExtras from "./VesselExtras";

// branch → header label, TYPE label, and accent color (matches the map marker)
function baseBranch(branch: string): {
  label: string;
  type: string;
  color: string;
} {
  if (branch === "NAVAL")
    return { label: "NAVAL BASE", type: "Naval Base", color: "#00e5ff" };
  if (branch === "AIR")
    return { label: "AIR BASE", type: "Air Base", color: "#b14bff" };
  return { label: "ARMY / GROUND", type: "Army / Ground", color: "#ff5a4d" };
}

/** External action buttons for a selected base — real public links, no API. */
function BaseExtras({
  name,
  lat,
  lon,
}: {
  name: string;
  lat: number;
  lon: number;
}) {
  const wiki = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(
    name
  )}`;
  // Google Maps centred on the base with the satellite layer forced (!3m1!1e3)
  const sat = `https://www.google.com/maps/@${lat},${lon},4000m/data=!3m1!1e3`;
  const cls =
    "border border-wv-border py-1.5 text-center text-[10px] font-bold tracking-[0.16em] text-wv-text transition-colors hover:border-wv-cyan hover:text-wv-cyan hover:box-glow-cyan";
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <a href={wiki} target="_blank" rel="noopener noreferrer" className={cls}>
        WIKIPEDIA →
      </a>
      <a href={sat} target="_blank" rel="noopener noreferrer" className={cls}>
        SATELLITE →
      </a>
    </div>
  );
}

/** Photo (via Wikipedia) + role + embarked-aircraft for a selected navy vessel. */
function NavyExtras({ ship }: { ship: Extract<FeedEntity, { kind: "navyShips" }> }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!ship.wiki) return;
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ship.wiki)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setImg(d?.thumbnail?.source ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ship.wiki]);

  return (
    <div className="mb-2">
      {img && (
        <img
          src={img}
          alt=""
          referrerPolicy="no-referrer"
          className="mb-2 max-h-32 w-full rounded-sm object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <div className="mb-1 text-[9px] tracking-[0.2em] text-wv-muted">ROLE</div>
      <p className="text-[10px] leading-relaxed text-wv-text/85">{ship.role}</p>
      {ship.embarked && ship.embarked.length > 0 && (
        <>
          <div className="mb-1 mt-2 text-[9px] tracking-[0.2em]" style={{ color: "#5dff9e" }}>
            EMBARKED AIRCRAFT
          </div>
          <div className="flex flex-col gap-1">
            {ship.embarked.map((a, i) => (
              <div
                key={i}
                className="border border-wv-border px-2 py-1 text-[10px] text-wv-text/85"
                style={{ background: "rgba(93,255,158,0.06)" }}
              >
                {a}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-wv-muted">{label}</span>
      <span className="text-right text-wv-text tabular-nums">{value}</span>
    </div>
  );
}

function timeAgo(ms: number): string {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Scrollable list of real, clickable headlines for a selected world-event node. */
function EventHeadlines({
  event,
}: {
  event: Extract<FeedEntity, { kind: "events" }>;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[9px] tracking-[0.2em] text-wv-muted">
        LATEST COVERAGE
      </div>
      <div className="wv-scroll flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
        {event.headlines.map((h, i) => (
          <a
            key={`${h.url}:${i}`}
            href={h.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border-l border-wv-border pl-2 transition-colors hover:border-wv-cyan"
          >
            <div className="text-[10px] leading-snug text-wv-text/90 group-hover:text-wv-cyan">
              {h.title || "(untitled report)"}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[9px] text-wv-muted">
              <span className="truncate">{h.domain}</span>
              <span className="shrink-0">· {timeAgo(h.time)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function fields(e: FeedEntity): { title: string; rows: [string, React.ReactNode][] } {
  switch (e.kind) {
    case "flights": {
      const knots = Math.round(e.velocity * 1.94384);
      const vs = e.verticalRate;
      const vsStr =
        vs > 0.3
          ? `▲ ${Math.abs(vs).toFixed(1)} m/s`
          : vs < -0.3
            ? `▼ ${Math.abs(vs).toFixed(1)} m/s`
            : "LEVEL";
      const rows: [string, React.ReactNode][] = [
        ["STATUS", e.onGround ? "ON GROUND" : "AIRBORNE"],
      ];
      if (e.aircraftType) rows.push(["TYPE", e.aircraftType]);
      if (e.registration) rows.push(["REG", e.registration]);
      if (e.country) rows.push(["ORIGIN", e.country]);
      rows.push(
        ["ALT", `${Math.round(e.altitude).toLocaleString()} m`],
        ["SPD", `${knots} kn`],
        ["HDG", `${Math.round(e.heading)}°`],
        ["V/S", vsStr],
        ["ICAO", e.id.toUpperCase()]
      );
      return { title: e.callsign, rows };
    }
    case "ships": {
      const rows: [string, React.ReactNode][] = [["TYPE", e.type]];
      if (e.flag) rows.push(["FLAG", e.flag]);
      if (e.status) rows.push(["STATUS", e.status]);
      rows.push(
        ["COURSE", `${Math.round(e.heading)}°`],
        ["SPEED", `${e.speed.toFixed(1)} kn`]
      );
      if (e.length)
        rows.push([
          "SIZE",
          e.beam
            ? `${Math.round(e.length)} × ${Math.round(e.beam)} m`
            : `${Math.round(e.length)} m`,
        ]);
      if (e.draught) rows.push(["DRAUGHT", `${e.draught.toFixed(1)} m`]);
      if (e.destination) rows.push(["DEST", e.destination]);
      if (e.eta) rows.push(["ETA", e.eta]);
      rows.push(["MMSI", e.id]);
      if (e.imo) rows.push(["IMO", String(e.imo)]);
      if (e.callsign) rows.push(["CALLSIGN", e.callsign]);
      return { title: e.name, rows };
    }
    case "satellites":
      return {
        title: e.name,
        rows: [
          [
            "ORBIT",
            e.orbit === "GEO" ? "GEOSTATIONARY (GEO)" : "LOW EARTH (LEO)",
          ],
          ["ALT", `${e.altKm.toLocaleString()} km`],
          ["NORAD", e.id],
        ],
      };
    case "earthquakes":
      return {
        title: `M${e.mag.toFixed(1)} SEISMIC EVENT`,
        rows: [
          ["REGION", e.place],
          ["MAG", e.mag.toFixed(1)],
          ["DEPTH", `${e.depth.toFixed(0)} km`],
          ["TIME", new Date(e.time).toISOString().slice(11, 19) + "Z"],
        ],
      };
    case "bases": {
      const br = baseBranch(e.branch);
      const fl = countryFlag(e.country);
      const rows: [string, React.ReactNode][] = [];
      rows.push([
        "LOCATION",
        e.country ? (
          <span>
            {fl && <span className="mr-1">{fl.emoji}</span>}
            {fl && <span className="text-wv-muted">{fl.iso2} </span>}
            {e.country}
          </span>
        ) : (
          "—"
        ),
      ]);
      if (e.operator) rows.push(["OPERATOR", e.operator]);
      rows.push(["TYPE", <span style={{ color: br.color }}>{br.type}</span>]);
      return { title: e.name, rows };
    }
    case "navyShips": {
      const rows: [string, React.ReactNode][] = [
        ["CLASS", e.shipClass],
        ["GROUP", e.fleetGroup],
      ];
      if (e.crew) rows.push(["CREW", e.crew]);
      if (e.displacement) rows.push(["DISPLACEMENT", e.displacement]);
      if (e.operator) rows.push(["OPERATOR", e.operator]);
      if (e.asOf) rows.push(["AS OF", e.asOf]);
      return { title: e.name, rows };
    }
    case "fires": {
      const sat =
        e.satellite === "N"
          ? "SUOMI-NPP"
          : e.satellite === "1" || e.satellite === "N20"
            ? "NOAA-20"
            : e.satellite || "VIIRS";
      // VIIRS reports confidence as a single letter (l/n/h); MODIS as 0–100.
      const conf =
        e.confidence === "h"
          ? "High"
          : e.confidence === "n"
            ? "Nominal"
            : e.confidence === "l"
              ? "Low"
              : e.confidence || "—";
      return {
        title: "ACTIVE FIRE",
        rows: [
          ["FRP", `${e.frp.toFixed(1)} MW`],
          ["BRIGHTNESS", `${e.brightness.toFixed(0)} K`],
          ["CONFIDENCE", conf],
          ["SENSOR", `${sat} · ${e.daynight === "N" ? "NIGHT" : "DAY"}`],
          ["DETECTED", new Date(e.acq).toISOString().slice(11, 16) + "Z"],
          ["SOURCE", "NASA FIRMS"],
        ],
      };
    }
    case "events":
      return {
        title: e.name,
        rows: [
          ["COVERAGE", `${e.count} article${e.count === 1 ? "" : "s"} / 24h`],
          ["LATEST", new Date(e.latest).toISOString().slice(11, 16) + "Z"],
          ["BASIS", "MEDIA ORIGIN"],
        ],
      };
    case "strikes": {
      const confColor =
        e.confidence === "HIGH" ? "#ff414e" : e.confidence === "MEDIUM" ? "#ffb347" : "#9aa5b1";
      const rows: [string, React.ReactNode][] = [
        ["DATE", new Date(e.time).toISOString().slice(0, 10)],
        ["TYPE", e.stype],
        ["ACTOR", e.actor],
        ["TARGET", e.target],
      ];
      if (e.fatalities != null) rows.push(["FATALITIES", String(e.fatalities)]);
      rows.push(["CONFIDENCE", <span style={{ color: confColor }}>{e.confidence}</span>]);
      rows.push(["SOURCE", e.source]);
      return { title: e.name, rows };
    }
    // ---- INFRA point sites (all 9 share the InfraSite shape) ----
    case "lng":
    case "nuclear":
    case "oilgas":
    case "refineries":
    case "airports":
    case "minerals":
    case "datacenters":
    case "desal":
    case "ports": {
      const rows: [string, React.ReactNode][] = [];
      if (e.country) {
        const fl = countryFlag(e.country);
        rows.push([
          "COUNTRY",
          <span>
            {fl && <span className="mr-1">{fl.emoji}</span>}
            {e.country}
          </span>,
        ]);
      }
      if (e.status) rows.push(["STATUS", e.status]);
      if (e.operator) rows.push(["OPERATOR", e.operator]);
      if (e.stype) rows.push(["TYPE", e.stype]);
      if (e.capacity) rows.push(["CAPACITY", e.capacity]);
      if (e.code) rows.push(["CODE", e.code]);
      return { title: e.name, rows };
    }
    // ---- INFRA routes (pipelines / submarine cables share InfraLine) ----
    case "pipelines":
    case "cables": {
      const rows: [string, React.ReactNode][] = [];
      if (e.operator) rows.push(["OPERATOR", e.operator]);
      if (e.status) rows.push(["STATUS", e.status]);
      if (e.length) rows.push(["LENGTH", e.length]);
      if (e.country) rows.push(["REGION", e.country]);
      if (e.code) rows.push(["ID", e.code]);
      return { title: e.name, rows };
    }
    case "gdp": {
      const rows: [string, React.ReactNode][] = [
        ["GDP / CAPITA", `$${Math.round(e.value).toLocaleString()}`],
      ];
      if (e.year) rows.push(["YEAR", String(e.year)]);
      rows.push(["BASIS", "WORLD BANK"]);
      return { title: e.name, rows };
    }
    case "waterstress": {
      const band =
        e.score >= 4 ? "#e0294a" : e.score >= 3 ? "#ff5630" : e.score >= 2 ? "#ff9e3c" : e.score >= 1 ? "#ffd23c" : "#cdcf6a";
      const rows: [string, React.ReactNode][] = [
        ["OVERALL RISK", <span style={{ color: band }}>{e.label}</span>],
        ["RISK SCORE", `${e.score.toFixed(2)} / 5`],
      ];
      if (e.country) {
        const fl = countryFlag(e.country);
        rows.push([
          "COUNTRY",
          <span>
            {fl && <span className="mr-1">{fl.emoji}</span>}
            {e.country}
          </span>,
        ]);
      }
      return { title: e.name, rows };
    }
    case "majorrivers": {
      const rows: [string, React.ReactNode][] = [["FEATURE", "Major river"]];
      if (e.country) rows.push(["REGION", e.country]);
      return { title: e.name, rows };
    }
    case "wevents": {
      const sevColor =
        e.severity === "CRITICAL" ? "#ff2d6a" : e.severity === "HIGH" ? "#ff5630" : e.severity === "MEDIUM" ? "#ffb347" : "#9aa5b1";
      const rows: [string, React.ReactNode][] = [
        ["TYPE", e.etype],
        ["SEVERITY", <span style={{ color: sevColor }}>{e.severity}</span>],
        ["CONFIDENCE", e.confidence],
      ];
      if (e.theater) rows.push(["THEATER", e.theater]);
      if (e.actors) rows.push(["ACTORS", e.actors]);
      if (e.location) rows.push(["LOCATION", e.location]);
      rows.push(["SOURCE", e.source], ["TIME", timeAgo(e.time)]);
      return { title: e.name, rows };
    }
    case "conflicts": {
      const intColor = /high/i.test(e.intensity)
        ? "#e0294a"
        : /low/i.test(e.intensity)
          ? "#ffb347"
          : "#ff5630";
      const rows: [string, React.ReactNode][] = [
        ["TYPE", <span style={{ color: "#ff7a3c" }}>{e.ctype}</span>],
        ["PARTIES", e.parties],
        ["SINCE", e.since],
        ["INTENSITY", <span style={{ color: intColor }}>{e.intensity}</span>],
      ];
      return { title: e.name, rows };
    }
  }
}

/**
 * Detail for the currently selected globe entity — rendered inside the right
 * rail's side panel (content only; the rail provides the panel chrome/header).
 * Shows an empty state when nothing is selected.
 */
export default function EntityBody({
  onFlyTo,
}: {
  onFlyTo: (lon: number, lat: number, h?: number) => void;
}) {
  const selected = useWorldView((s) => s.selected);

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-2xl text-wv-muted">⌖</span>
        <span className="text-[10px] tracking-widest text-wv-muted">
          NO CONTACT SELECTED
        </span>
        <span className="text-[9px] leading-relaxed text-wv-muted/70">
          Click any contact on the globe to inspect it here.
        </span>
      </div>
    );
  }

  const meta = LAYER_BY_ID[selected.kind];
  const { title, rows } = fields(selected);
  const e = selected as unknown as { lon: number; lat: number; altKm?: number };
  // bases get a branch-specific header + accent (army/naval/air); everything
  // else uses its layer's label + color.
  const accent =
    selected.kind === "bases" ? baseBranch(selected.branch).color : meta.color;
  const headerLabel =
    selected.kind === "bases" ? baseBranch(selected.branch).label : meta.label;

  return (
    <div className="px-3 py-3">
      <div
        className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.18em]"
        style={{ color: accent }}
      >
        <span>{meta.icon}</span>
        <span>{headerLabel}</span>
      </div>
      <div>
        <div
          className="mb-2 truncate text-[13px] font-bold"
          style={{ color: accent }}
        >
          {title}
        </div>

        {/* aircraft photo + live world-count + history link */}
        {selected.kind === "flights" && (
          <FlightExtras hex={selected.id} reg={selected.registration} />
        )}

        {/* real vessel photo (VesselFinder) + live vessel count */}
        {selected.kind === "ships" && (
          <VesselExtras mmsi={selected.id} name={selected.name} />
        )}

        {/* curated navy vessel — photo + role + embarked aircraft */}
        {selected.kind === "navyShips" && <NavyExtras ship={selected} />}

        {/* world-event headlines (real, clickable news links) */}
        {selected.kind === "events" && <EventHeadlines event={selected} />}

        <div className="text-[10px]">
          {rows.map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
          <Row
            label="POS"
            value={`${e.lat.toFixed(3)}, ${e.lon.toFixed(3)}`}
          />
        </div>

        {/* INFRA: optional description blurb + data provenance */}
        {meta.group === "INFRA" && (
          <>
            {"note" in selected &&
              (selected as { note?: string }).note && (
                <p className="mt-2 text-[10px] leading-relaxed text-wv-text/75">
                  {(selected as { note?: string }).note}
                </p>
              )}
            <p className="mt-2 text-[9px] text-wv-muted">Source: {meta.source}</p>
          </>
        )}

        {/* curated conflict description + "for live data" footer */}
        {selected.kind === "conflicts" && (
          <>
            {selected.note && (
              <p className="mt-2 text-[10px] leading-relaxed text-wv-text/75">
                {selected.note}
              </p>
            )}
            <p className="mt-2 text-[9px] text-wv-muted">
              Curated conflict overview. For live event data, use the Events layer.
            </p>
          </>
        )}

        {/* strike / event description + source link (deltasweep VIEW SOURCE) */}
        {(selected.kind === "strikes" || selected.kind === "wevents") && (
          <>
            {selected.note && (
              <p className="mt-2 text-[10px] leading-relaxed text-wv-text/75">
                {selected.note}
              </p>
            )}
            {selected.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block border border-wv-border py-1.5 text-center text-[10px] font-bold tracking-[0.16em] text-wv-text transition-colors hover:border-wv-cyan hover:text-wv-cyan hover:box-glow-cyan"
              >
                VIEW SOURCE →
              </a>
            )}
          </>
        )}

        {/* water-risk provenance footer (deltasweep-style) */}
        {selected.kind === "waterstress" && (
          <p className="mt-2 text-[10px] leading-relaxed text-wv-text/75">
            WRI Aqueduct 4.0 — aggregated baseline water risk (physical quantity &
            quality + regulatory/reputational), HydroSHEDS L6 basin.
          </p>
        )}

        <button
          onClick={() =>
            onFlyTo(
              e.lon,
              e.lat,
              selected.kind === "satellites"
                ? ((e.altKm ?? 500) + 3000) * 1000
                : 400_000
            )
          }
          className="mt-3 w-full border border-wv-border py-1.5 text-[10px] font-bold tracking-[0.2em] text-wv-text transition-colors hover:border-wv-cyan hover:text-wv-cyan hover:box-glow-cyan"
        >
          ⌖ LOCK & TRACK
        </button>

        {/* real public action links for a base (Wikipedia + satellite imagery) */}
        {selected.kind === "bases" && (
          <BaseExtras name={selected.name} lat={e.lat} lon={e.lon} />
        )}
      </div>
    </div>
  );
}
