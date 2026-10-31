# Ravenscourt Park / borough hotspot audit — 31 October 2026

## Verified identity and boundary

- Official eBird hotspot: **Ravenscourt Park**, **L939893**:
  https://ebird.org/hotspot/L939893
- Coordinates from the official page's Directions link:
  **51.4966678, -0.2383518** (latitude, longitude).
- The official page showed zero October 2026 checklists and its latest checklist
  dated 11 September 2026. The retained borough feed contains 11 reports from
  that date under the same official ID. No October reports have been invented.
- The updater's existing Planning Data boundary, entity **8600296**, identifies
  Hammersmith and Fulham / **E09000013**:
  https://www.planning.data.gov.uk/entity/8600296.geojson
- Applying the existing polygon test to that downloaded boundary gives
  Ravenscourt **inside**, and WWT's existing configured coordinate
  (51.4774486, -0.235101) **outside**.
- WWT's existing separate eBird feed identifies **L939896**. The reserve is in
  Barnes, south of the Thames:
  https://www.wwt.org.uk/wetland-centres/london/plan-your-visit/directions

## Root cause

The updater discovers both recent and all nearby hotspots, but selects only
recently active ones or a small explicit name allowlist. Ravenscourt was absent
from that allowlist. Once September's reports aged beyond 30 days it disappeared
from the map/directory, even though its retained reports remained. Its identity
was consistent; deduplication was not the cause. The October feed legitimately
contains no Ravenscourt sightings.

The current borough snapshot already contains no WWT reports. However, retained
records were only explicitly purged for Kensal Green; boundary filtering applied
only to new observations. Old WWT entries could survive, and the browser trusted
feed contents directly when calculating totals.

## Change

A shared, small borough hotspot policy holds the verified Ravenscourt identity
and WWT/Kensal exclusions. The updater monitors Ravenscourt regardless of recent
activity, using existing location/recent and notable endpoints with normal
validity and polygon checks. Its directory fallback uses the verified public
coordinate if discovery omits the inactive hotspot. Existing observations are
retained, canonicalised by ID and deduplicated without merging distinct
checklists.

WWT exclusions apply by ID and legacy name at discovery, new hotspot/nearby
acceptance, retained-data merge and browser feed loading. Thus excluded rows
cannot contribute to map markers, hotspot lists, species counts, contributors or
other Actual Sightings calculations. The separate WWT comparison feed/page and
historical archive are unchanged. The service worker cache is versioned and the
new module is available offline. Workflow path triggers include the shared policy.

The committed observation snapshot adds Ravenscourt's directory entry only;
all existing report records and their dates are unchanged. Ten hotspots are now
listed, with Ravenscourt honestly showing zero October reports.

## Validation and limits

- Full suite: **147/147 pass**, including four new regression tests.
- The real updater runs twice against isolated mocked API responses: inactive
  hotspot requests, separate checklists, duplicate rows, validity, privacy,
  outside-boundary rejection and WWT removal all pass.
- Existing offline API fixtures now copy the updater's shared dependency and
  return an empty Ravenscourt response, preserving their original assertions.
- Desktop 1440px and mobile 390px checks confirm Ravenscourt is visible, with
  zero October reports. Injected renamed-ID and legacy-name WWT records do not
  alter map/list/species/contributor totals or appear in Local sightings.
- Syntax and whitespace checks pass. No deployment or push was performed.
- A live authenticated eBird API refresh was not run locally: the direct public
  API request returned 403 without the repository's secret. Identity/coordinates
  were verified from the official eBird page in the browser; refresh integration
  is tested offline. The existing GitHub Actions secret remains the live API path.
