# Monthly collected sightings — 31 October 2026

## Retention audit

The existing updater already keeps reports across refreshes and calendar months.
It reads `dist/data/observations.json`, merges new validated API reports into a
Map, and writes the union back. Its unchanged identity is:

`species | date | (hotspotId || hotspot) | (checklistId || '')`

Same-key corrections replace fields; different checklists remain distinct.
Missing/deleted API rows and old keys after date corrections remain retained;
this release does not change those ingestion/reconciliation semantics. API
failures occur before writing the snapshot, and an empty API response does not
clear retained reports. The daily Actions workflow checks out committed data,
commits refreshed feeds and uploads `dist` directly to Pages. That architecture
can safely retain additional JSON files without a database or identity change.

The snapshot used here contains 288 reports: September 2026 (97), October 2026
(191). The original website always filtered to the viewer's current month and
had no previous-month selector. The new view uses Europe/London, independently
of the viewer/device timezone. Stored eBird observation dates are already local
YYYY-MM-DD dates; they are partitioned literally, never shifted as UTC instants.

## Archive structure

- `dist/data/sightings-archive/YYYY-MM.json`: source/schema version, London time
  zone, explicit partial-coverage notice, first/latest observation dates, source
  feed provenance, derived totals, public hotspot directory and public records.
- `dist/data/sightings-archive/index.json`: deterministic available-month index
  and per-month coverage/totals for future expansion.
- No observer names, coordinates of personal report locations, private fields or
  user display details are copied into monthly records. Public hotspot directory
  coordinates and existing checklist IDs are retained: the latter are part of
  the approved identity and are not replaced with a new identifier.

First available month is **2026-09**: 97 reports, 43 species, observations dated
10–28 September. **2026-10** has 191 reports, 50 species, dated 3–30 October.
These are earliest/latest *collected observations*, not complete coverage dates.
No observations before 10 September are available in this snapshot. Internal
missing dates, unvisited locations, failed refresh periods and the API's 30-day
window/latest-per-species geospatial sampling are coverage limitations. Neither
month is a complete census. No historical species aggregate was repurposed into
invented individual observations, and no live API backfill was performed.

## Archive generation and persistence

Run `npm run archive:sightings`. The generator validates every existing monthly
file and incoming record before writing any output. It merges previously
archived observations by the exact existing key, preserves absent rows, accepts
late observations/corrections and sorts deterministically. Invalid dates,
inconsistent year/month fields, corrupt JSON or invalid source metadata fail
without overwriting good files. Files are replaced atomically and unchanged
bytes are not rewritten. Coverage provenance stays unchanged on no-op refreshes.
An empty feed preserves existing archives and does not invent an empty month.

WWT and Kensal Green exclusions apply to retained and incoming archive records.
Ravenscourt Park uses official L939893 and its reports are retained. The separate
WWT comparison page/feed and BirdWeather/NBN pipelines remain unchanged.

Actions now serializes feed-refresh runs, archives only when the borough updater
succeeds, and stages archive JSON alongside the existing feeds. A failed API run
skips archiving. A failed archive validation leaves old files in place and is
reported as a failed step without blocking the other existing feed pipelines.
Temporary files are not staged. Existing git-diff gating avoids empty commits;
other feed freshness timestamps can still legitimately cause daily commits.
The existing Pages artifact already includes all of `dist`, including archives.
No force-push, history rewrite or new external service is needed.

## Website behaviour

Actual Sightings has **This Month / Last Month**, defaulting to This Month, with
an explicit month/year and coverage notice. Selecting a month updates local
sightings, species totals, last-recorded dates, hotspot counts/lists/map data and
report-date ranges. Existing sort order and accordion navigation remain intact.
The section tab is named Actual Sightings so it does not incorrectly say This
Month while showing last month. Movements remains on the current calendar month;
BirdWeather remains explicitly a separate recent-detections feed. Historical
rankings and archive species tables are unchanged.

Past-month observer names are intentionally unavailable, and the contributor
card displays a dash with an explanatory notice rather than a false zero.
Missing/corrupt archives fall back only to already retained validated reports
for that month and clearly disclose the fallback. With no retained records, the
UI says no collected archive is available, not that birds were absent. When the
live feed is unavailable, existing monthly files can still be viewed. Rapid
selection changes cannot display the previous response under a new month label.
The service worker caches the selector modules and monthly files for offline
revisits, using network-first archive reads to avoid freezing late additions.

## Validation

- `npm test`: **156/156 pass** (nine new monthly tests).
- London month/year rollover, DST/device-timezone independence, leap dates,
  identity/duplicate handling, deterministic repeated refreshes, late reports,
  empty/fewer inputs, same-key/date corrections, privacy, WWT/Kensal exclusions,
  Ravenscourt inclusion, totals, invalid-source preservation and workflow
  persistence are covered by tests.
- `npm run archive:sightings` repeated: **0 changed files**.
- Desktop 1440px/mobile 390px: current/previous switching, selected dates and
  totals, September Ravenscourt reports, WWT exclusion and Movements isolation.
- Browser failure cases: missing month, failed live feed, corrupt/wrong-month
  archive and November rollover while device timezone is Los Angeles all pass.
- Existing boards' regression suite passes. The existing navigation-copy test
  was updated for the Actual Sightings tab label; no assertions were removed.
- `node --check` and `git diff --check` pass.

Browser regression command (Playwright is an optional local test dependency):

```
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-monthly-sightings-browser.cjs
```

Previews: `/private/tmp/hf-monthly-selector-1440.png` and
`/private/tmp/hf-monthly-selector-390.png`.

## Files added/changed in the monthly extension

- `.github/workflows/update-ebird.yml`
- `package.json`
- `scripts/archive-sightings.mjs`
- `scripts/check-monthly-sightings-browser.cjs`
- `dist/index.html`
- `dist/sw.js`
- `dist/sightings-months.mjs`
- `dist/sightings-history.mjs`
- `dist/data/sightings-archive/index.json`
- `dist/data/sightings-archive/2026-09.json`
- `dist/data/sightings-archive/2026-10.json`
- `test/monthly-sightings.test.mjs`
- `test/movements-board.test.mjs`
- `docs/monthly-sightings-history.md`

Implementation is on `codex/fix-ravenscourt-hotspot`, alongside the preceding
hotspot restoration/exclusion commit. No merge, push or deployment is performed.
