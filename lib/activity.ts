// Classify GDELT conflict coverage into the ACTIVITY feed's categories. Runs in
// the GitHub Action (scripts/fetch-events.ts) on a clean IP — GDELT blocks
// Vercel — reusing the shared parse helpers in lib/gdelt. Keyword-based, so it's
// best-effort OSINT (not curated like ACLED); see [[feedback-worldview-real-data-only]].
import type { ActivityEvent, ActivityCategory } from "./types";
import { GDELT_DOC, parseSeen, cleanTitle, type GdeltArticle } from "./gdelt";

// conflict-focused GDELT query (language-independent GKG themes)
export const ACTIVITY_QUERY = "(theme:ARMEDCONFLICT OR theme:TERROR)";

export function buildActivityUrl(): string {
  const u = new URL(GDELT_DOC);
  u.searchParams.set("query", ACTIVITY_QUERY);
  u.searchParams.set("mode", "artlist");
  u.searchParams.set("format", "json");
  u.searchParams.set("maxrecords", "250");
  u.searchParams.set("timespan", "24h");
  u.searchParams.set("sort", "datedesc");
  return u.toString();
}

// most-specific category first (an item matching several wins the top one)
const CATS: [ActivityCategory, string[]][] = [
  ["NAVAL", ["navy", "naval", "warship", "destroyer", "frigate", "submarine", "aircraft carrier", "fleet", "maritime", "coast guard"]],
  ["AIR", ["airstrike", "air strike", "air raid", "warplane", "fighter jet", "air force", "air defense", "air defence", "drone strike", "drone attack", "drone", "helicopter gunship", "sortie", "no-fly"]],
  ["EXPLOSION", ["explosion", "blast", " ied", "car bomb", "suicide bomb", "roadside bomb", "detonat"]],
  ["STRIKE", ["missile", "rocket", "shelling", "bombard", "artillery strike", "precision strike"]],
  ["DIPLOMATIC", ["ceasefire", "truce", "negotiat", "peace talk", "peace deal", "summit", "diplomat", "treaty", "sanction", "accord", "prisoner swap", "peace plan"]],
  ["GROUND", ["troops", "soldier", "infantry", "tank", "artillery", "offensive", "ground assault", "border clash", "militia", "frontline", "incursion", "ambush"]],
];
// conflict words that don't pin a category → bucketed as GROUND
const GENERIC = ["attack", "clash", "militant", "insurgent", "warfare", "killed", "gunmen", "raid", "siege", "fighting", "assault"];

function categoryOf(t: string): ActivityCategory | null {
  for (const [cat, kws] of CATS) if (kws.some((k) => t.includes(k))) return cat;
  if (GENERIC.some((k) => t.includes(k))) return "GROUND";
  return null;
}

const HIGH = ["killed", "dead", " dies", "death toll", "casualties", "fatalities", "massacre", "dozens dead"];
const MED = ["wounded", "injured", "attack", "strike", "blast", "explosion"];
function severityOf(t: string, cat: ActivityCategory): ActivityEvent["severity"] {
  if (HIGH.some((k) => t.includes(k))) return "HIGH";
  if (["STRIKE", "AIR", "EXPLOSION", "NAVAL"].includes(cat) || MED.some((k) => t.includes(k)))
    return "MEDIUM";
  return "LOW";
}

/** Keyword-classify one headline into a category + severity (null if not conflict). */
export function classifyTitle(
  title: string
): { category: ActivityCategory; severity: ActivityEvent["severity"] } | null {
  const t = title.toLowerCase();
  const cat = categoryOf(t);
  if (!cat) return null;
  return { category: cat, severity: severityOf(t, cat) };
}

/** Classify + de-dupe GDELT articles into ACTIVITY events (newest first). */
export function classifyActivity(articles: GdeltArticle[], max = 120): ActivityEvent[] {
  const seen = new Set<string>();
  const out: ActivityEvent[] = [];
  for (const a of articles) {
    if (!a.url || seen.has(a.url)) continue;
    const title = cleanTitle(a.title);
    if (!title) continue;
    const c = classifyTitle(title);
    if (!c) continue;
    seen.add(a.url);
    out.push({
      id: a.url,
      category: c.category,
      severity: c.severity,
      title,
      url: a.url,
      domain: a.domain ?? "",
      time: parseSeen(a.seendate),
    });
  }
  out.sort((x, y) => y.time - x.time);
  return out.slice(0, max);
}
