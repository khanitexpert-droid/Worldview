"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoResult } from "@/app/api/geocode/route";

/**
 * Top-left geocoder search. Type a city or country; results stream from
 * /api/geocode (OpenStreetMap Nominatim) and clicking one flies the camera
 * there — to the place's bounding box when known (so a country frames the whole
 * country and a city frames the city), else to a point.
 */
export default function SearchBar({
  onFlyTo,
  onFlyToRect,
}: {
  onFlyTo: (lon: number, lat: number, height?: number) => void;
  onFlyToRect: (
    west: number,
    south: number,
    east: number,
    north: number
  ) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // set just before we programmatically set the query on select, so the
  // resulting debounce run skips searching and doesn't re-open the dropdown.
  const suppressRef = useRef(false);

  // debounced query → /api/geocode
  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        const data = (await res.json()) as { results: GeoResult[] };
        setResults(data.results ?? []);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted or failed — leave previous results */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // close the dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (r: GeoResult) => {
    if (r.bbox) {
      const [south, north, west, east] = r.bbox;
      onFlyToRect(west, south, east, north);
    } else {
      onFlyTo(r.lon, r.lat, 150_000);
    }
    abortRef.current?.abort(); // cancel any in-flight search
    suppressRef.current = true; // don't let the setQ below re-open the dropdown
    setQ(primary(r.name));
    setResults([]);
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (results[active] ?? results[0]) go(results[active] ?? results[0]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="fixed top-[88px] right-3 z-40 w-60">
      <div className="hud-panel corner-ticks flex items-center gap-2 px-2.5 py-1.5">
        <span className="text-wv-cyan glow-cyan text-[13px] leading-none">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          placeholder="SEARCH CITY / COUNTRY…"
          spellCheck={false}
          className="w-full bg-transparent text-[11px] tracking-wide text-wv-text placeholder:text-wv-muted focus:outline-none"
        />
        {loading ? (
          <span className="text-[11px] text-wv-violet">···</span>
        ) : q ? (
          <button
            onClick={() => {
              setQ("");
              setResults([]);
              setOpen(false);
            }}
            className="text-[11px] text-wv-muted hover:text-wv-magenta"
            aria-label="clear"
          >
            ✕
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <div className="wv-panel-in hud-panel wv-scroll mt-1 max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.lat},${r.lon},${i}`}
              onClick={() => go(r)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors ${
                i === active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
              }`}
            >
              <span className="mt-[2px] shrink-0 text-[10px] text-wv-cyan">◉</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-wv-text">
                  {primary(r.name)}
                </span>
                {secondary(r.name) && (
                  <span className="block truncate text-[9.5px] text-wv-muted">
                    {secondary(r.name)}
                  </span>
                )}
              </span>
              {r.kind && (
                <span className="mt-[2px] shrink-0 text-[8.5px] uppercase tracking-wider text-wv-violet/80">
                  {r.kind}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && q.trim().length >= 2 && (
        <div className="hud-panel mt-1 px-2.5 py-2 text-[10px] tracking-wide text-wv-muted">
          NO MATCHES
        </div>
      )}
    </div>
  );
}

// "Paris, Île-de-France, France" → "Paris"
function primary(name: string): string {
  return name.split(",")[0]?.trim() ?? name;
}
// → "Île-de-France, France"
function secondary(name: string): string {
  return name.split(",").slice(1).join(",").trim();
}
