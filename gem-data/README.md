# GEM source spreadsheets (drop zone)

Drop the raw Global Energy Monitor tracker files here, **as-is** (no renaming —
the parser auto-detects them by filename). These are build-time inputs; the
`.xls`/`.xlsx` themselves are git-ignored. Running `node scripts/parse-gem.mjs`
parses them into `public/infra_*.json`.

Get the files (each needs a short free form, CC-BY 4.0):

| File to download | Tracker | Upgrades layer(s) |
|---|---|---|
| Global Gas Infrastructure Tracker (GGIT) | https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/ | LNG Terminals + gas Pipelines |
| Global Oil Infrastructure Tracker (GOIT) | https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/ | oil Pipelines |
| Global Oil & Gas Extraction Tracker (GOGET) | https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/ | Oil & Gas Fields |

Note: GEM has **no** refinery tracker — the Refineries layer stays curated.
