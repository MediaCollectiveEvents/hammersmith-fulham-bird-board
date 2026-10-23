# Hammersmith & Fulham Bird Arrivals and Departures

A free, static monthly board for seasonal bird movements and eBird reports from hotspots and other mapped locations in the London Borough of Hammersmith & Fulham.

## GitHub Pages setup

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
3. In **Settings → Secrets and variables → Actions**, add repository secret `EBIRD_API_KEY` with the personal key from eBird.
4. Run **Update eBird observations** once from the Actions tab. The Pages workflow deploys on pushes to `main`; the updater runs daily at 05:23 UTC and can also be started manually.

For free GitHub Pages on GitHub Free, the repository needs to be public. Do not commit the eBird key. The updater uses it only in the Actions runner and writes filtered public observations to `dist/data/observations.json`.

## Data and limits

- The updater fetches non-provisional reports from eBird hotspot feeds and the recent nearby geospatial feed, then checks observation coordinates against the Hammersmith & Fulham borough polygon from Planning Data. Nearby results at known borough hotspots are excluded from the additional location set so the board can label the two kinds of reports separately. Private locations are omitted.
- The feed is updated daily. Hotspot queries cover the most recent 30 days; eBird's nearby feed returns recent records (the latest observation per species in the search area), not every checklist. Daily runs retain accepted records so reports stay available by month and year.
- Only this small, curated set is included: Sand Martin, Swallow, House Martin, Common Swift, Common Whitethroat, Redwing, Fieldfare, Brambling and Siskin. This reduces rarity/passage noise but does not certify breeding or exclude every bird that may have been flying over. eBird hotspot reports are evidence of reports at a mapped location, not proof of first arrival, residence, breeding or departure.
- eBird does not provide a borough migration calendar from its regional summaries. Expected dates in the page are provisional seasonal guidance, not live predictions. Actual eBird reports are shown for the selected month and year.
- If Actions stop for more than 30 days, some observations can fall outside the API window before they are archived. Run the workflow regularly.

## Expected board seasonality

Seasonality is a downstream output of the public-layer build. The existing DuckDB step must first create `birds_hf_public.csv` from `hf_ebird_records_final.csv` and apply `excluded_taxa.csv`. Immediately after that step, add this command to `refresh.sh`:

```sh
npm run build:seasonality -- /path/to/hf_ebird_records_final.csv /path/to/birds_hf_public.csv
```

The public-layer CSV determines the seasonality species universe and expected row count on every build. The generator rejects blank or duplicate common names, filters the full observation archive to that set, and the validator requires exact species-set equality. There is no fixed species-count setting. Raw eBird source records should stay out of the public site and repository; only the derived calendar and audit outputs belong in `dist/data`.

The calendar includes the modal arrival/departure month, its frequency, and the number of completed years contributing timing evidence. It also emits validation, audit, and change-history CSVs. Timing excludes the current incomplete year; earliest/latest occurrence months include it. Residents, low-evidence species, and irregular species have no board timing.

## BirdWeather acoustic detections

A separate public BirdWeather feed is refreshed daily by the same GitHub Actions workflow. It requests BirdNET detections from the last 24 hours at confidence 0.70 or higher, then checks detection coordinates against the exact Hammersmith & Fulham boundary before writing `dist/data/birdweather.json`. No BirdWeather key is required. The page labels these as automated audio detections: they are not human-verified sightings, proof of species presence, or counts of individual birds. The feed keeps coordinates private and displays the station, timestamp and model confidence.

## Recorded species: eBird archive

This is an explicit source switch from NBN Atlas to eBird archive aggregates, not a display-only change. The 133 public-layer entries include two hybrids; the displayed entry count is not a strict species count. Membership changes and provenance are detailed in `docs/recorded-species-source-switch-review.md`.

The Recorded species panel uses `dist/data/ebird-history.json`, generated from the validated `birds_hf_public.csv` and matching borough eBird archive. It publishes only species names, scientific names, archive record counts and the latest observation date per species. Dates mean **last recorded in the supplied archive**, not the latest sighting anywhere in the borough. The recent API feed remains separate; it does not automatically refresh these historical aggregates. Missing records do not establish absence.

Regenerate manually after obtaining updated, validated inputs:

```sh
python3 scripts/import-ebird-history.py /private/path/birds_hf_public.csv /private/path/hf_ebird_records_final.csv dist/data/ebird-history.json
```

The exporter checks public-layer uniqueness and reconciles each species' count and date range against the archive. Keep raw source data, observers, checklist IDs and coordinates private. This display change does not adopt API archive ingestion or alter the Expected board pipeline. The legacy NBN importer and credited JSON remain available in the repository, but the Recorded species panel no longer uses them.

## Local validation

```sh
node --check scripts/update-ebird.mjs
```

No API key is needed to preview the static page. The empty feed is deliberate; no sightings are fabricated.
