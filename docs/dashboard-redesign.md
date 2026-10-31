# Homepage, news and migration review — 31 October 2026

## Audit and scope

The starting homepage placed category navigation and detailed concertinas ahead of seasonal context. It used global yellow/dark tokens, with arrivals and departures populated by the validated migration calendar. Species cards, reviewed Commons photographs, eBird archive rankings, borough hotspot policy, monthly sightings, BirdWeather, PWA installation and fullscreen TV already existed.

The October calendar really contains **Skylark arrival; Buzzard, Snipe and Skylark departure**, all Low confidence. These are modes of annual first/last record months, not independently verified ecological arrival windows. The redesign preserves these counts and explains their meaning. Calendar generation and validation are unchanged.

`birds_hf_public.csv` and `hf_ebird_records_final.csv` are named upstream inputs but are not checked into this checkout. The checked-in publication layer is `species_migration_calendar.csv`, `seasonality_metadata.json` and `bird-rankings.json`. New editorial/migration context requires the existing rankings validator and matching READY release hashes. No raw input, publication flag or biological classification has been rewritten.

No separately reviewed continuous-presence windows or route-publication dataset was found. Inline legacy route examples are not sufficient route verification. Routes therefore remain withheld; country-only/max-three rendering is not activated without verified inputs. Here This Season shows classified migrants with a current human report or positive historical monthly records, explicitly labelled as those evidence types. Historical minima/maxima are never joined into a continuous stay.

The archive identity “Green-winged Teal” is associated with `Anas crecca`. Both sides of that discrepancy are held from the new editorial/migration features, as are unresolved, slash and hybrid identities. The historical archive itself is unchanged.

## Implementation

Homepage order is header/update → Bird News → Arrivals/Departures/Here → current sightings overview → detailed boards. The original logo and Swift icons remain. Detailed month selection is independent of the current-month homepage; switching to Last Month never relabels migration/news as that month.

`dashboard-data.mjs` derives headline candidates deterministically. Priority is archive rarity, eBird notable, calendar arrival plus actual report, first retained seasonal report, hotspot activity, then reporting-rank rise. Duplicate species are suppressed; at most four supported headlines appear. Equal rarity uses original common name. Rank rises are sorted by change and clearly refer to the archive's dated reporting window, not population growth. Hotspots must appear in the validated borough directory. Dates and locations refer to the specific supporting record.

First retained seasonal headlines additionally load the indexed archives for the current meteorological season, include the current feed, and check the earliest available report. Archive failures withhold that category. Coverage is explicitly partial: this is never a first-ever, comprehensive census or confirmed migration-arrival claim.

Here prioritises current human reports. Three entries are initially visible, with an accessible Show all control. All entries remain available to TV pagination. Timelines display actual historical monthly counts, unknown values as `?`, and A/D report-month markers. Human reports and thresholded current-month BirdWeather detections are separate evidence states. Acoustic detections are not human sightings.

The existing species-card component handles all species buttons. A small event allows matching eligible cards to gain verified calendar context, without replacing existing card facts, ranks, photographs or RSPB links. All photographs pass the existing reviewed rights/identity manifest validator; credits include source, licence, attribution and modifications, with explicit headline cropping information. Missing photographs never block cards or tables.

Logo green **#216e4b** comes directly from `dist/icons/bird.svg`. Purple **#5e2d79 was explicitly approved by the user** as the complementary accent: the public council HTML was readable but its linked stylesheet assets returned 404 during review. It is not represented as a verified council brand value. Yellow UI is scoped to the migration panel. White/off-white and pale green/purple support the rest of the interface. Core normal-text colour pairs exceed WCAG AA contrast.

The Contributors markup and `renderObservers` function are byte-identical to the previous feature baseline. Its dark layout is preserved with scoped tokens to protect it from the surrounding light theme. Its navigation entry remains available.

TV retains full-screen 16:9, previous/next buttons and arrow keys, one table at a time, fixed readable typography and measured pagination. Native details content needs an explicit available-height calculation. Pagination includes row margins. An existing BirdWeather `.join()` emitted comma text between rows, causing unmeasured spacing; it is now `.join('')`. This is a rendering-only correction, with no feed change. Exiting TV restores all five row groups.

Service-worker version is incremented and new dashboard assets use the existing shell/network-first conventions. Manifest colours align with the new interface. No ingestion, deduplication, observation identities, monthly archive protections, borough policy, data files or GitHub Actions workflows changed in this redesign.

## Validation

- `npm test`: 167 tests pass, zero failures (156 existing + 11 dashboard tests).
- `git diff --check` and Node syntax checks pass.
- Optional browser check: `PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-dashboard-browser.cjs`.
- Dashboard: 390px/1440px layout and no horizontal overflow; exact October movement counts; species-card enrichment; seasonal expansion; photo fallback; failed release/archive states; primary green and no migration yellow outside the panel.
- TV: 1920×1080, all five views across 15 pages, previous/next and exit, no rows clipped within tables or viewport.
- Monthly browser regression: both widths, This/Last Month totals and dates, Ravenscourt, WWT exclusion, missing/invalid archives, failed live feed and London rollover.
- Contributors markup/renderer compared byte-for-byte; protected data/pipeline paths have no diff.
- Static site: no production bundler, TypeScript or lint command is configured. Tests and direct browser execution exercise the shipped modules.

Local screenshots: `/private/tmp/hf-dashboard-390.png`, `/private/tmp/hf-dashboard-1440.png`, `/private/tmp/hf-dashboard-tv-arrivals.png`, `/private/tmp/hf-dashboard-tv-here.png`. Preview crops use `hf-dashboard-preview-390.png` and `hf-dashboard-preview-1440.png` in the same directory.

## Remaining evidence limits

The existing monthly sample starts September 2026 and is partial. Original archive rankings remain dated to their published release. Missing reports do not demonstrate absence. No verified routes or continuous-presence windows are invented. The approved purple is a design choice, not a claimed verified council brand standard. Nothing has been pushed, merged or deployed.
