# Rolling Actual Sightings

## Production diagnosis (2 November 2026)

Production and immutable main 90432112b63a6e4c7d6fa7d14689e2010cf91d77 matched byte-for-byte for the checked feeds and archives. The 1 November 11:54 UTC borough feed retained 288 records, but all were dated September/October; latest observation was 30 October. The November-only selector therefore correctly returned zero records while hiding recent October sightings. A disposable production browser reproduced this with service workers both blocked and enabled, without JavaScript errors. No renewed publication overwrite or service-worker masking was found.

The rolling window on 2 November covers 4 October–2 November: 186 collected reports, 48 species. This is a UI/date-selection correction, not a feed backfill. Independent BirdWeather data was updated 1 November 11:54 UTC (163 acoustic detections); the separate WWT feed had 754 records and latest observation 31 October. Neither is evidence of human borough sightings in November.

## Implementation

Actual Sightings defaults to Last 30 Days, with This Week and Today buttons immediately above its table. London civil date labels are compared directly with validated observation dates; calendar arithmetic does not reinterpret observation dates as UTC instants. Weeks start Monday. Last 30 Days can require three month files (e.g. 1 March after a non-leap February).

Monthly archives and retained live records are combined using the unchanged species/date/location/checklist identity. Live duplicates take precedence; deterministic date/key sorting precedes existing alphabetical species grouping. Borough sanitization applies to both sources, including Ravenscourt L939893 and existing WWT/Kensal exclusions. Archive files, ingestion, identity and publication workflows are unchanged.

Selected-period counts and hotspot lists follow the selection. Homepage reporting, news, Expected and Historical remain independent. Contributors remains current-month/live-feed only: archives are never used to reconstruct observer names. BirdWeather retains its independent recent-detections board; WWT remains outside borough totals and available through existing species context.

Feed status shows reliable updatedAt metadata, offline status, missing archive coverage and an explicit warning after 48 hours. The 48-hour threshold tolerates the daily collector's scheduling delay; it is a display warning, not a completeness claim or recovery action. Missing archives fall back to retained feed records. A wholly unavailable source displays an unavailable state instead of asserting zero sightings. Empty valid selections say “No sightings recorded for this period.” All coverage remains partial.

## Validation and limits

Automated date checks cover October/November, December/January, leap years, BST start/end, Monday boundaries, inclusive endpoints, multiple archives, deduplication, live corrections and stale/unavailable status. Browser regression covers all three selections, counts, empty/unavailable/stale/malformed-archive states, month isolation and overflow at 390/1440/1920px. Existing dashboard checks cover tablet, cards/navigation and paginated 1920×1080 TV views. Real service-worker checks exercise v35→v37 upgrade, old-cache removal, manifest/installability signal and warm-cache offline reload with retained October records.

Native PWA installation/launch and physical casting remain unverified in headless Chrome. Offline data is only available after warming the relevant cache. Observation records have day precision, so same-day observation times cannot be filtered more finely. No absent reports are invented, no archived month is a census, and the recent acoustic feed cannot reconstruct a 30-day acoustic history. No production data or settings were changed.
