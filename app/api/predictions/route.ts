import type { PredictionMarket } from "@/lib/types";

export const dynamic = "force-dynamic";

// PREDICTION MARKETS — real-money odds from Kalshi's public events API (no key).
// (Polymarket is geo-blocked from many regions; Kalshi is reachable + regulated.)
// We keep news-relevant categories and surface, per event, the leading outcome.
const CATS = new Set([
  "Politics",
  "World",
  "Economics",
  "Financials",
  "Elections",
  "Companies",
]);
const MAX = 8;
const CACHE_TTL = 300_000; // 5 min

let cache: { at: number; items: PredictionMarket[] } | null = null;

interface KMarket {
  yes_sub_title?: string;
  title?: string;
  last_price_dollars?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  volume_fp?: string;
}
interface KEvent {
  event_ticker?: string;
  title?: string;
  category?: string;
  markets?: KMarket[];
}

const num = (s?: string) => {
  const n = parseFloat(s || "");
  return Number.isFinite(n) ? n : 0;
};

// YES probability (0..1): last trade, else bid/ask midpoint
function prob(m: KMarket): number {
  const last = num(m.last_price_dollars);
  if (last > 0) return last;
  return (num(m.yes_bid_dollars) + num(m.yes_ask_dollars)) / 2;
}

function json(items: PredictionMarket[], sMaxAge: number, error?: string) {
  return Response.json(
    { items, source: "Kalshi", fetchedAt: new Date().toISOString(), error },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=600`,
      },
    }
  );
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL) return json(cache.items, 300);

  try {
    const res = await fetch(
      "https://api.elections.kalshi.com/trade-api/v2/events?limit=200&status=open&with_nested_markets=true",
      { cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`kalshi ${res.status}`);
    const data = (await res.json()) as { events?: KEvent[] };

    const rows: PredictionMarket[] = [];
    for (const ev of data.events ?? []) {
      const mkts = ev.markets ?? [];
      if (!ev.category || !CATS.has(ev.category) || !mkts.length) continue;
      const totalVol = mkts.reduce((s, m) => s + num(m.volume_fp), 0);
      // representative market = the most likely outcome
      const top = mkts.reduce((best, m) => (prob(m) > prob(best) ? m : best), mkts[0]);
      const p = prob(top);
      if (p <= 0.01 || p >= 0.99) continue; // skip settled / boring
      if (totalVol < 50) continue; // skip dead markets
      rows.push({
        id: ev.event_ticker || ev.title || String(rows.length),
        title: ev.title || "",
        outcome: mkts.length > 1 ? top.yes_sub_title : undefined,
        prob: p,
        volume: totalVol,
        category: ev.category,
      });
    }
    rows.sort((a, b) => b.volume - a.volume);
    const items = rows.slice(0, MAX);

    if (items.length) {
      cache = { at: Date.now(), items };
      return json(items, 300);
    }
    if (cache) return json(cache.items, 60);
    return json([], 60);
  } catch (err) {
    if (cache) return json(cache.items, 60);
    return json([], 60, String(err));
  }
}
