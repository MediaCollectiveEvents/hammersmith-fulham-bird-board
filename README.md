# Hammersmith & Fulham Bird Arrivals and Departures

A free, static monthly board for seasonal bird movements and actual eBird hotspot reports in the London Borough of Hammersmith & Fulham.

## GitHub Pages setup

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
3. In **Settings → Secrets and variables → Actions**, add repository secret `EBIRD_API_KEY` with the personal key from eBird.
4. Run **Update eBird observations** once from the Actions tab. The Pages workflow deploys on pushes to `main`; the updater runs daily at 05:23 UTC and can also be started manually.

For free GitHub Pages on GitHub Free, the repository needs to be public. Do not commit the eBird key. The updater uses it only in the Actions runner and writes filtered public observations to `dist/data/observations.json`.

## Data and limits

- The updater fetches non-provisional reports from eBird's recent geospatial API, asks for hotspot observations, then checks each observation coordinate against the Hammersmith & Fulham borough polygon from Planning Data.
- The feed is updated daily and the API query covers the most recent 30 days. Daily runs retain observed records in the repository so reports stay available by month and year.
- Only this small, curated set is included: Sand Martin, Swallow, House Martin, Common Swift, Common Whitethroat, Redwing, Fieldfare, Brambling and Siskin. This reduces rarity/passage noise but does not certify breeding or exclude every bird that may have been flying over. eBird hotspot reports are evidence of reports at a mapped location, not proof of first arrival, residence, breeding or departure.
- eBird does not provide a borough migration calendar from its regional summaries. Expected dates in the page are provisional seasonal guidance, not live predictions. Actual eBird reports are shown for the selected month and year.
- If Actions stop for more than 30 days, some observations can fall outside the API window before they are archived. Run the workflow regularly.

## BirdWeather acoustic detections

A separate public BirdWeather feed is refreshed daily by the same GitHub Actions workflow. It requests BirdNET detections from the last 24 hours at confidence 0.70 or higher, then checks detection coordinates against the exact Hammersmith & Fulham boundary before writing `dist/data/birdweather.json`. No BirdWeather key is required. The page labels these as automated audio detections: they are not human-verified sightings, proof of species presence, or counts of individual birds. The feed keeps coordinates private and displays the station, timestamp and model confidence.

## NBN Atlas bird record list

The board includes a source list of bird taxa recorded in the London Borough of Hammersmith & Fulham, based on an NBN Atlas export confirmed by the project owner to cover the borough. The NBN archive is incomplete, so it is used only to list recorded taxa and is not used to determine expected monthly arrivals or departures. A missing record is not evidence that a bird was absent.

The public aggregate keeps bird names, taxonomic rank and overall occurrence-record totals only. Counts are records, not individual birds. It excludes dates, recorder names and coordinates. Provider, dataset, licence and attribution details are retained in `dist/data/nbn-history.json` and shown on the page. The export contains records under CC-BY-NC, Open Government Licence and CC-BY terms; keep this project and the derived list non-commercial and preserve the source credits.

To rebuild the list after downloading a fresh NBN Atlas CSV export:

```sh
node scripts/import-nbn.mjs path/to/nbn-export.csv
```

Do not commit the downloaded source CSV or publish record-level exports. The importer outputs only the borough bird list and aggregate occurrence totals.

## Local validation

```sh
node --check scripts/update-ebird.mjs
```

No API key is needed to preview the static page. The empty feed is deliberate; no sightings are fabricated.
