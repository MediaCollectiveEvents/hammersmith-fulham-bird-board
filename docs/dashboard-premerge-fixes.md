# Three pre-merge fixes — 31 October 2026

Starting commit: `cf58096`, branch `codex/bird-dashboard-redesign`. **Go for human merge review**, subject to the native installation and real casting limitations below. Nothing pushed, merged or deployed.

## Changes

1. The global month heading remains the current London reporting month. The existing archive selector updates only its relevant board context; the Local sightings heading now includes its selected month/year, beside the existing archive controls' period label. News and current-month summary remain independent. Browser regressions exercise October/September, December/November and January/December, including missing archives without inventing reports.
2. Fixed TV typography: species names **32px**, scientific names and classification **22px**, evidence/timing **24px**, timeline month labels/counts **22px**, timeline explanations **20px**. Controls/count label also enlarged. These are actual computed sizes at 1920×1080. No font fitting or dynamic shrinking is used. Existing measured pagination now takes **21 pages across five views**, with fewer rows per screen, one complete table at a time, no horizontal overflow and no clipped rows. The fresh Here screen displays three rows rather than five. Yellow-on-charcoal remains scoped to migration.
3. Five native links just below the header provide Sightings, Movements, Rankings, Hotspots and Historical Records. At 390×844, the nav starts **177px from the top**, occupies 100px across two rows, and has 44px-high targets. The old detailed nav was about 6,608px down. Keyboard activation opens the correct board, selects its category, scrolls instantly to it and places focus on its summary. The bento grid is retained. The longer migration explanation is now expandable; route withholding and timeline explanations appear once per section instead of repeatedly in every normal row. Evidence states and individual historical counts remain visible. Full TV and species-card timeline explanations remain available.

## Service-worker verification and focused correction

Tests run against a real localhost service-worker origin using a fresh persistent Chrome profile, with HTTP cache disabled to isolate Cache Storage. The test first serves the actual cf58096 shell/worker, then switches to the current files without editing either checkout.

The check exposed a cache race in the pre-existing worker: default assets/navigation cloned responses inside an asynchronous cache-open callback, after the page could consume them. Metadata/calendar responses were absent offline. The worker now clones before returning the response and extends its lifetime with `event.waitUntil` for cache writes. Calendar and publication metadata join the existing network-first assets so the matching release can refresh online and fall back offline. Cache version is v36. No ingestion or publication rules changed; mismatched releases still fail verification.

Verified:

- Manifest parses with valid scope/start URL and standalone display.
- Worker installs, activates and controls the page.
- Chrome reports **zero installability errors**, emits a genuine `beforeinstallprompt`, and the mobile install control is visible.
- Updating the served release activates v36, removes v35 and loads the new shortcuts.
- Warm-cache offline reload retains news, styles, current totals, keyboard/native shortcuts and the previously visited September archive; homepage/archive period labels stay separate.
- Three unit regressions consume the network response before the delayed cache opens, then verify asset, metadata and navigation fallback while offline.

Limits: headless Chrome cannot verify completing native installation, launching an installed standalone app, device-specific browser menus, real casting hardware or a physical TV viewing distance. Offline testing is for previously loaded data; unvisited resources are not promised offline. Simulated network-offline failures are expected to reach Cache Storage fallback. No blanket WCAG certification is claimed.

## Validation

- `npm test`: **170 pass / 0 fail** (all original 167 plus three cache tests).
- Dashboard browser regression: **390, 768, 1440 and 1920px**, keyboard activation/focus of all five shortcuts, no horizontal overflow, measured TV sizes and 21-page bounds, species cards, image fallback, failed publication/archive handling and colour checks pass.
- Monthly browser regression: both responsive widths, archived/current dates and totals, December/January labels, Ravenscourt inclusion, WWT exclusion, failed live feed, missing/invalid archives and London rollover pass.
- Service-worker-enabled PWA check: installation eligibility, update and warm-cache offline scenarios pass, with native UI limitations above.
- `git diff --check` and Node syntax checks pass.
- Contributors markup and renderer compared byte-for-byte against cf58096. Its styling/rows were not modified. No protected datasets, observation identity/deduplication, archives, pipeline scripts or workflow files changed.

Commands: `npm test`; set `PLAYWRIGHT_MODULE` to an installed Playwright, then run `node scripts/check-dashboard-browser.cjs`, `node scripts/check-monthly-sightings-browser.cjs`, and `node scripts/check-dashboard-pwa.cjs`.

## Files changed

- `dist/index.html`: month scoping, selected sightings title, compact shortcuts and expandable explanation.
- `dist/dashboard.css`: shortcut targets/spacing, condensed normal layout, larger fixed TV type.
- `dist/dashboard.mjs`: remove repeated route-withholding row notices; retain the section-level statement.
- `dist/sw.js`: v36 and verified cache timing/lifetime correction.
- `scripts/check-dashboard-browser.cjs`: shortcut, tablet, size and page checks; after screenshots.
- `scripts/check-monthly-sightings-browser.cjs`: independent period labels and year-boundary regressions.
- `scripts/check-dashboard-pwa.cjs`: real-worker installability/update/offline check.
- `test/dashboard-pwa-cache.test.mjs`: three cache-race regressions.
- `docs/dashboard-redesign.md` and this report: validation and limitations.

## Before / after artifacts

All paths below are local review artifacts, not shipped assets.

| View | Before | After |
|---|---|---|
| Mobile full page | `/private/tmp/hf-dashboard-before-mobile.png` | `/private/tmp/hf-dashboard-after-390.png` |
| Desktop full page | `/private/tmp/hf-dashboard-before-desktop.png` | `/private/tmp/hf-dashboard-after-1440.png` |
| TV Here screen | `/private/tmp/hf-dashboard-before-tv.png` | `/private/tmp/hf-dashboard-after-tv-here.png` |
| Archive selection / global month | `/private/tmp/hf-review-last-month.png` | `/private/tmp/hf-dashboard-after-month-label.png` |
| Mobile top viewport | `/private/tmp/hf-dashboard-preview-390.png` | `/private/tmp/hf-dashboard-after-preview-390.png` |

Offline proof: `/private/tmp/hf-dashboard-pwa-offline.png`. Browser logs: `/private/tmp/hf-fixes-browser.log`, `/private/tmp/hf-fixes-months.log`, `/private/tmp/hf-fixes-pwa.log`. Test log: `/private/tmp/hf-fixes-final-tests.log`.
