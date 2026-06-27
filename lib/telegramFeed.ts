import type { SocialPost } from "./types";

/**
 * Shared upstream for the social-OSINT content. /api/activity pulls Telegram
 * posts from here and merges them (source hidden) into the conflict stream, so
 * the dependency lives in exactly one place. Server-side only — the browser
 * never sees this URL, just our own /api/* routes.
 */
const NEWS_PROXY = "https://www.deltasweep.com/.netlify/functions/news-proxy";

const UA = "Mozilla/5.0 (compatible; WorldViewBot/1.0; +osint-feed)";

/** A loosely-typed upstream record — the feeds use ad-hoc field names. */
export type Raw = Record<string, unknown>;

export const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export const firstPhoto = (...vals: unknown[]): string | undefined => {
  for (const v of vals) {
    if (typeof v === "string" && v.startsWith("http")) return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return undefined;
};

/** epoch ms from any of the upstream date fields (0 if none parse). */
export function epoch(it: Raw): number {
  for (const k of ["publishedAt", "published_at", "created_at", "time"]) {
    const t = Date.parse(String(it[k] ?? ""));
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

/** "7m ago"-style label from an epoch (fallback when upstream gives no label). */
export function relTime(ts: number): string {
  if (!ts) return "";
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clamp(text: string, n = 500): string {
  return text.length > n ? text.slice(0, n - 1).trimEnd() + "…" : text;
}

async function getJson(url: string, ms: number): Promise<Raw> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(ms),
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as Raw;
}

/** Map a Telegram OSINT item → SocialPost (source kept; callers may relabel). */
function fromTelegram(it: Raw): SocialPost | null {
  const url = str(it.url);
  const text =
    str(it._fullText) || str(it.summary) || str(it.raw_text) || str(it.title);
  if (!url || !text) return null;
  const ts = epoch(it);
  const channel = str(it._tg) || str(it.source_channel);
  return {
    id: url,
    platform: "telegram",
    source: str(it.source) || (channel ? `@${channel}` : "Telegram"),
    channel,
    text: clamp(text),
    time: str(it.time) || relTime(ts),
    ts,
    url,
    photo: firstPhoto(it._photos, it.photos),
    views: str(it._views) ?? (it.views != null ? String(it.views) : undefined),
    severity: str(it.severity),
  };
}

/** Most-recent Telegram OSINT posts (normalized, newest first). */
export async function fetchTelegramPosts(max = 60): Promise<SocialPost[]> {
  const d = await getJson(NEWS_PROXY, 9000);
  const arr = Array.isArray(d.osint) ? (d.osint as Raw[]) : [];
  return arr
    .map(fromTelegram)
    .filter((p): p is SocialPost => !!p)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, max);
}
