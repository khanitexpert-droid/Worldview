// Fetch GDELT from GitHub's runner IP — which GDELT serves, unlike Vercel's
// blocked datacenter IPs — aggregate, and write events.json. Run on a schedule
// by .github/workflows/events.yml, which publishes the file to the `data` branch
// for the app to read. (Reuses the shared parse/aggregate logic in lib/gdelt.)
import { writeFileSync } from "node:fs";
import { aggregate, buildDocUrl, QUERIES, type GdeltArticle } from "../lib/gdelt";
import { ACTIVITY_QUERY, classifyActivity } from "../lib/activity";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(query: string): Promise<GdeltArticle[]> {
  const res = await fetch(buildDocUrl(query), {
    headers: {
      "user-agent":
        "WORLDVIEW-events-bot/1.0 (+https://worldview-henna.vercel.app)",
    },
  });
  if (!res.ok) throw new Error(`gdelt HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trimStart().startsWith("{")) {
    throw new Error(`gdelt non-json: ${text.slice(0, 80)}`);
  }
  return (JSON.parse(text).articles ?? []) as GdeltArticle[];
}

async function main() {
  const merged = new Map<string, GdeltArticle>();
  let ok = 0;
  for (let i = 0; i < QUERIES.length; i++) {
    if (i > 0) await sleep(5500); // stay under GDELT's 1-request/5s limit
    try {
      for (const a of await fetchOne(QUERIES[i])) {
        if (a.url) merged.set(a.url, a);
      }
      ok++;
      console.log(`query ${i + 1}/${QUERIES.length} ok — merged ${merged.size} articles`);
    } catch (e) {
      console.log(`query ${i + 1}/${QUERIES.length} FAILED: ${String(e)}`);
    }
  }
  if (ok === 0) {
    console.error("ALL GDELT QUERIES FAILED — runner IP appears blocked by GDELT");
    process.exit(1);
  }
  const items = aggregate([...merged.values()]);
  const payload = { items, source: "gdelt", fetchedAt: new Date().toISOString() };
  writeFileSync("events.json", JSON.stringify(payload));
  console.log(`WROTE events.json: ${items.length} countries from ${merged.size} articles`);

  // ---- ACTIVITY feed: a dedicated conflict query, classified into categories.
  // Falls back to classifying the already-merged articles if the extra query
  // fails, so activity.json is ALWAYS written (the publish step copies it).
  let conflict: GdeltArticle[] = [];
  await sleep(5500); // stay under GDELT's 1-request/5s limit
  try {
    conflict = await fetchOne(ACTIVITY_QUERY);
    console.log(`activity query ok — ${conflict.length} conflict articles`);
  } catch (e) {
    console.log(`activity query FAILED: ${String(e)} — classifying merged set`);
  }
  const activity = classifyActivity([...conflict, ...merged.values()]);
  writeFileSync(
    "activity.json",
    JSON.stringify({ items: activity, source: "gdelt", fetchedAt: new Date().toISOString() })
  );
  console.log(`WROTE activity.json: ${activity.length} classified events`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
