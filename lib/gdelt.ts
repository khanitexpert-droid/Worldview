import type { EventHeadline, WorldEvent } from "./types";
import { centroidFor } from "./countryCentroids";

// GDELT DOC 2.0 — full-text news index, refreshed every 15 min, no key needed.
// It sets `Access-Control-Allow-Origin: *`, so the browser can call it directly.
// We prefer that (each visitor's own IP) because GDELT hard-throttles datacenter
// IPs — our Vercel server gets a permanent 429, but residential IPs are fine.
// (The old GEO 2.0 API that returned per-location GeoJSON has been retired.)
export const GDELT_DOC = "https://api.gdeltproject.org/api/v2/doc/doc";

// language-independent GDELT GKG themes: unrest / war / disaster / terror.
export const THEME_QUERY =
  "(theme:PROTEST OR theme:ARMEDCONFLICT OR theme:NATURAL_DISASTER OR theme:TERROR)";
// broad world-affairs keywords: politics / economy / justice / health / weather.
export const BROAD_QUERY =
  "(election OR vote OR parliament OR summit OR sanctions OR economy OR inflation OR court OR verdict OR trial OR outbreak OR storm OR wildfire OR earthquake OR ceasefire OR diplomacy OR treaty OR strike)";
// incidents / breaking keywords.
export const KEYWORD_QUERY =
  "(protest OR clash OR attack OR explosion OR flood OR evacuation OR crash OR shooting OR coup OR resignation OR scandal OR border OR missile OR drone OR riot OR arrest)";

// The client fires these in sequence (spaced for GDELT's rate limit) and merges
// the results — far more countries / coverage than a single 250-record query.
export const QUERIES = [THEME_QUERY, BROAD_QUERY, KEYWORD_QUERY];

const MAX_HEADLINES = 25; // per country, kept in the detail panel

export interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language?: string;
  sourcecountry?: string;
}

export function buildDocUrl(query: string): string {
  const u = new URL(GDELT_DOC);
  u.searchParams.set("query", query);
  u.searchParams.set("mode", "artlist");
  u.searchParams.set("format", "json");
  u.searchParams.set("maxrecords", "250");
  u.searchParams.set("timespan", "24h");
  u.searchParams.set("sort", "datedesc");
  return u.toString();
}

// "20260619T160000Z" -> epoch ms
export function parseSeen(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s ?? "");
  if (!m) return Date.now();
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// GDELT tokenises titles with spaces around punctuation ("Acht - Stunden - Tag",
// "word ?"). Tidy the obvious cases without mangling the text.
export function cleanTitle(t: string): string {
  return (t ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?»)])/g, "$1")
    .replace(/([«(])\s+/g, "$1")
    .trim();
}

/** Cluster GDELT articles into one WorldEvent per source country (centroid). */
export function aggregate(articles: GdeltArticle[]): WorldEvent[] {
  const byCountry = new Map<string, WorldEvent>();

  for (const a of articles) {
    const country = (a.sourcecountry ?? "").trim();
    if (!country) continue;
    const c = centroidFor(country);
    if (!c) continue;

    const time = parseSeen(a.seendate);
    const headline: EventHeadline = {
      title: cleanTitle(a.title),
      url: a.url,
      domain: a.domain ?? "",
      time,
      language: a.language,
    };

    const ev = byCountry.get(country);
    if (ev) {
      ev.count++;
      if (time > ev.latest) ev.latest = time;
      ev.headlines.push(headline);
    } else {
      byCountry.set(country, {
        id: country.toLowerCase().replace(/[^a-z]+/g, "-"),
        name: country,
        lon: c[0],
        lat: c[1],
        count: 1,
        latest: time,
        headlines: [headline],
      });
    }
  }

  const items = [...byCountry.values()].map((ev) => ({
    ...ev,
    headlines: ev.headlines
      .sort((a, b) => b.time - a.time)
      .slice(0, MAX_HEADLINES),
  }));
  items.sort((a, b) => b.count - a.count); // biggest hotspots first
  return items;
}

// NOTE: the live GDELT fetch runs in scripts/fetch-events.ts on GitHub Actions
// (a clean IP GDELT will serve) — not in the browser or on Vercel, both of whose
// IPs GDELT blocks. This module only provides the shared query + parse +
// aggregate helpers that the Action (and any server code) reuses.
