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

## Historical NBN archive

The board also uses a supplied NBN Atlas occurrence export, confirmed by the project owner to contain records within the London Borough of Hammersmith & Fulham. The public file stores aggregate counts by species, month, and year only; it does not publish recorder names, coordinates, or raw records. It contains 15,400 bird occurrence records for 129 taxa from 2016–2025, including 1,572 records supplied at month-level date precision. These are records, not individual bird counts. They provide historical borough-wide monthly context and are not precise eBird hotspot data. A month with no record is not evidence that a species was absent.

The dataset includes records under CC-BY-NC, Open Government Licence, and CC-BY terms. This project is non-commercial. Retain the NBN Trust and data-partner/dataset credits in the board, and keep the derived archive non-commercial. The board loads the credits from `dist/data/nbn-history.json` in its archive-source details.

To rebuild the aggregate after downloading a fresh NBN Atlas CSV export:

```sh
node scripts/import-nbn.mjs path/to/nbn-export.csv
```

Do not commit the downloaded source CSV or publish record-level exports. The script preserves all bird records with a year/month and omits exact locations and recorder identities.

## Local validation

```sh
node --check scripts/update-ebird.mjs
```

No API key is needed to preview the static page. The empty feed is deliberate; no sightings are fabricated.
