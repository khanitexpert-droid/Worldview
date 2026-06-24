import type { MarketQuote } from "@/lib/types";

export const dynamic = "force-dynamic";

// MARKETS — a lean, grouped ticker board (deltasweep parity, cleaner layout).
// Quoted via Yahoo Finance's public chart endpoint: no API key, one consistent
// JSON shape for commodities / indices / crypto / FX, relayed server-side so the
// browser never deals with CORS. Deliberately a curated set, not a wall of rows.
const INSTRUMENTS: { symbol: string; label: string; group: string }[] = [
  // ENERGY
  { symbol: "CL=F", label: "Crude Oil · WTI", group: "ENERGY" },
  { symbol: "BZ=F", label: "Brent Crude", group: "ENERGY" },
  { symbol: "NG=F", label: "Natural Gas", group: "ENERGY" },
  // METALS
  { symbol: "GC=F", label: "Gold", group: "METALS" },
  { symbol: "SI=F", label: "Silver", group: "METALS" },
  { symbol: "PL=F", label: "Platinum", group: "METALS" },
  { symbol: "HG=F", label: "Copper", group: "METALS" },
  // INDICES
  { symbol: "^GSPC", label: "S&P 500", group: "INDICES" },
  { symbol: "^IXIC", label: "Nasdaq", group: "INDICES" },
  { symbol: "^DJI", label: "Dow Jones", group: "INDICES" },
  { symbol: "^VIX", label: "Volatility · VIX", group: "INDICES" },
  // CRYPTO
  { symbol: "BTC-USD", label: "Bitcoin", group: "CRYPTO" },
  { symbol: "ETH-USD", label: "Ethereum", group: "CRYPTO" },
  { symbol: "SOL-USD", label: "Solana", group: "CRYPTO" },
  { symbol: "XRP-USD", label: "XRP", group: "CRYPTO" },
  // FX
  { symbol: "DX-Y.NYB", label: "US Dollar Index", group: "FX" },
  { symbol: "EURUSD=X", label: "EUR / USD", group: "FX" },
];

const SPARK_POINTS = 28;
const CACHE_TTL = 20_000; // ms — module cache so panel polls don't hammer Yahoo

// warm-lambda memo of the last good board (also used to ride out a Yahoo blip)
let cache: { at: number; items: MarketQuote[] } | null = null;

interface YahooChart {
  chart: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
    error?: unknown;
  };
}

// evenly thin a series down to n points for the sparkline
function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const out: number[] = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

async function quote(inst: (typeof INSTRUMENTS)[number]): Promise<MarketQuote | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(inst.symbol)}` +
    `?range=1d&interval=15m`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    // Yahoo 429s requests with no UA
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WorldViewBot/1.0)" },
  });
  if (!res.ok) throw new Error(`${inst.symbol} ${res.status}`);
  const data = (await res.json()) as YahooChart;
  const r = data.chart?.result?.[0];
  const price = r?.meta?.regularMarketPrice;
  const prev = r?.meta?.chartPreviousClose ?? r?.meta?.previousClose;
  if (price == null || prev == null) return null;
  const closes = (r?.indicators?.quote?.[0]?.close ?? []).filter(
    (v): v is number => typeof v === "number"
  );
  return {
    symbol: inst.symbol,
    label: inst.label,
    group: inst.group,
    price,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    spark: downsample(closes.length >= 2 ? closes : [prev, price], SPARK_POINTS),
  };
}

function json(items: MarketQuote[], sMaxAge: number) {
  return Response.json(
    { items, source: "Yahoo Finance", fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=60`,
      },
    }
  );
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL) return json(cache.items, 20);

  const settled = await Promise.allSettled(INSTRUMENTS.map(quote));
  const items = settled.flatMap((s) =>
    s.status === "fulfilled" && s.value ? [s.value] : []
  );

  if (items.length) {
    cache = { at: Date.now(), items };
    return json(items, 20);
  }
  // every symbol failed — serve the last good board if we have one
  if (cache) return json(cache.items, 10);
  return json([], 10);
}
