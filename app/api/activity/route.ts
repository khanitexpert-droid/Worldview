import type { ActivityEvent } from "@/lib/types";
import { existsSync, readFileSync } from "node:fs";

export const dynamic = "force-dynamic";

// ACTIVITY data is produced by the SAME scheduled GitHub Action as world-events
// (scripts/fetch-events.ts classifies GDELT conflict coverage into categories and
// writes activity.json, published to the `data` branch). GDELT blocks Vercel's
// IPs, so we never fetch GDELT here — we relay the Action's file. In local dev,
// if you've run the script (activity.json at the project root), we serve that so
// you can preview real data before the Action has published.
const DATA_URL =
  "https://raw.githubusercontent.com/khanitexpert-droid/Worldview/data/activity.json";

interface Payload {
  items: ActivityEvent[];
  source: string;
  live: boolean;
  fetchedAt: string;
  error?: string;
}

function json(p: Payload) {
  const fresh = p.items.length > 0;
  return Response.json(p, {
    headers: {
      "Cache-Control": fresh
        ? "public, s-maxage=120, stale-while-revalidate=86400"
        : "public, s-maxage=20",
    },
  });
}

export async function GET() {
  // dev convenience: serve a locally-generated activity.json if present
  if (process.env.NODE_ENV !== "production" && existsSync("activity.json")) {
    try {
      const d = JSON.parse(readFileSync("activity.json", "utf8")) as {
        items?: ActivityEvent[];
        fetchedAt?: string;
      };
      return json({
        items: d.items ?? [],
        source: "gdelt (local)",
        live: (d.items?.length ?? 0) > 0,
        fetchedAt: d.fetchedAt ?? new Date().toISOString(),
      });
    } catch {
      /* fall through to the data branch */
    }
  }

  try {
    const url = `${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`data branch ${res.status}`);
    const d = (await res.json()) as { items?: ActivityEvent[]; fetchedAt?: string };
    const items = d.items ?? [];
    return json({
      items,
      source: "gdelt",
      live: items.length > 0,
      fetchedAt: d.fetchedAt ?? new Date().toISOString(),
    });
  } catch (err) {
    return json({
      items: [],
      source: "fallback",
      live: false,
      fetchedAt: new Date().toISOString(),
      error: String(err),
    });
  }
}
