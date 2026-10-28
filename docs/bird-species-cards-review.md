# Bird Species Cards: five-taxon review

28 October 2026. Feature branch `feature/bird-species-cards`, based on `bea6167`.
This is a local review candidate. No production publication or full image expansion.

## Data readiness

The current checked-in public aggregate contains **133 taxa**, including two hybrid
entries, and **30,288 observation records**, spanning 1963-01-12–2026-09-28.
This was checked against the actual JSON and ranking rows, rather than inferred
from the README. These are named public taxa, not a strict biological species count.

| Field | Source and readiness |
|---|---|
| Common/scientific names | `dist/data/ebird-history.json`, exact validated public identities |
| Historical records, latest date | Same JSON; archive-relative reports, not bird counts or live sightings |
| Borough rank | Calculated descending records, then original common name ascending; reconciles to every ranking row |
| First date, existing category | Available in `bird-rankings.json`; optional extension deferred in this proof of concept |
| Seasonal timing | Existing CSV and READY metadata; omitted from cards pending classification review |
| Migration classification | Review explicitly withdrew public classification totals; not republished by cards |
| Route/origin/destination | Hard-coded guidance in existing Wetland page; no independent publication gate or approval evidence; not copied into cards |
| Historical hotspots | Deferred by rankings review pending geographical/public-location validation |
| RSPB species guide | Existing generic search links preserved; no invented species-specific URL |

There is no canonical taxon code in the historical JSON. Its source importer joins
exact public common names to scientific names. Cards use exact scientific names
as the downstream lookup key, preserve original identities and accept existing
British display aliases only when unambiguous. Unknown/ambiguous matches fail
closed. Hybrids remain distinct. No archive identities or ingestion are changed.

The raw `birds_hf_public.csv` and source archive are intentionally absent from this
public repository. The separate private DuckDB SQL generates the public layer and
applies exclusions; `upstream/refresh.sh` is an isolated prototype, not the installed
refresh system. Historical import checks count/date reconciliation. This work does
not alter ingestion, refresh, source CSV generation, ADR-001 or ADR-002.

The frontend is static HTML, inline JavaScript and ES modules, with no framework
or build step. Existing dark backgrounds, yellow controls, blue borders, native
concertinas and Arial typography are retained. GitHub Pages uploads `dist` on main;
that workflow is unchanged. Existing Node/Python tests run via `npm test`.

## Photographic coverage

Proof taxa: European Robin (resident), Barn Swallow (migrant), Mallard, Peregrine
Falcon and European Herring x Lesser Black-backed Gull (hybrid).

- Total public taxa: **133**.
- Verified photographs: **4**; missing photographs: **129**.
- Manual review: **1**, the hybrid, included within the 129 missing photographs.
- Other taxa not yet sourced: **128**. No full coverage claim.
- Licences: CC BY 2.5 × 1; CC BY-SA 2.5 × 1; CC BY-SA 3.0 × 1; CC BY-SA 4.0 × 1.
- Attribution completeness: **4/4 verified photographs** have creator, title,
  source file page, licence/version/URL, modification disclosure and verification evidence.

Candidates came from the supported Commons API, queried by scientific name.
Selected-file API metadata is retained in `docs/bird-photo-evidence/`.
Descriptions/categories and identifying plumage were checked, thumbnails visually
reviewed; egg, juvenile and mismatched candidates were rejected. Images illustrate
taxa; none is represented as a borough photograph. The hybrid has no image URL.

Only four review thumbnails were downloaded (about 508 KB total). Eight local
WebP derivatives (400px and 800px bounds) total about **260 KB on disk**. Local
assets avoid third-party requests and unpredictable thumbnail response times.
No original full-resolution files or batch library was downloaded. WebP resizing
and conversion are disclosed, without crop or editorial modification. Each
adapted photo retains its source licence, including share-alike terms; this does
not apply those licences to unrelated website code. Manifest credit links remain
visible to visitors and the full catalogue is version controlled.

## Component and integration

`bird-cards-data.mjs` handles identity, ranking, manifest validation and safe card
markup. `bird-cards.mjs` handles one shared native modal. `bird-cards.css` supplies
the responsive panel. No dependency was added. Loading, failed archive, unknown
taxon, absent photo and image-load failure have explicit states. Native modal
Escape/background inertness plus explicit Tab wrapping keep keyboard interactions
inside; Close/Escape restores the opener without scrolling. Data is loaded once
per page, and Commons is never queried by visitors. Invalid image catalogues fail
closed to placeholders.

On the main board, the shared species-link decoration covers Recorded Species,
Actual Sightings, Expected Arrivals/Departures, acoustic detections, hotspot and
contributor lists. Dynamically rendered ranking rows use the same lookup and
modal. RSPB links stay separately available with accessible names. Filters,
sorting, pagination, concertinas and scroll are not rerendered by opening a card.
The Wetland Centre species and movement tables use exact scientific-name buttons,
with their existing BTO references preserved. Unknown taxa show unavailable data.
There is no separate classification board in the current checkout.

## Validation and limits

- `npm test`: **114/114 passing**, including existing regressions and 11 new
  data/identity/rank/image-rights/attribution/privacy-safe rendering tests.
- Shared rank calculation reconciles all 133 rows to current ranking aggregates.
- Desktop 1440px and mobile 390px browser checks pass: keyboard activation,
  explicit focus wrap, Escape, Close, focus/scroll restoration, attribution,
  hybrid placeholder, image decoding, no card/page horizontal overflow and no JS errors.
- Main Recorded Species flow is exercised through actual navigation. Other
  integrations share the mechanism but are not all individually interaction-tested.
- Syntax checks and `git diff --check` pass; no compile/build command is needed.
- No production deploy, hosted preview, full WCAG audit or full-library sourcing.

For repeatable browser checks, serve `dist` at localhost:8765 and run
`node scripts/check-bird-cards-browser.cjs` with Playwright available. An existing
runtime may be supplied using `PLAYWRIGHT_MODULE`; `BIRD_BOARD_URL` and
`BIRD_SCREENSHOT_DIR` are configurable. Chrome is used; Playwright is not added
to production dependencies.

## Refreshing images and approval gate

Before replacing/adding an image: query Commons by exact scientific identity,
retain the selected metadata, review the photo, verify licence/version and creator,
regenerate bounded WebP derivatives and record modifications and licence on the
manifest. Never copy a parental photo onto a hybrid. Validate uniqueness and all
metadata with `npm test`, then check the card in browser. Update the service-worker
version when changing bundled assets; card modules/manifest/history use the
existing network-first asset path. No automatic refresh or API call is introduced.

**Approval is required before expanding the image catalogue beyond this proof of
concept or deploying the feature**, as requested in the execution sequence.

## Workbook facts follow-up (28 October 2026)

The supplied `HF_Bird_Top_Trumps_133_Rarity_Bird_Facts_Working.xlsx` was read
without editing it. Its SHA-256 and pilot sheet/row references are recorded in
`bird-facts.json`; the workbook itself is not copied into the public website.

The main sheet contains 133 rows: game/adult weight 130 populated, AVONET mass
130, wingspan 17, maximum age 36, historical nicknames 60, body length 0, clutch
size 2. Only two narrative facts are populated and both explicitly require
entry-level verification; neither is published. All other narrative-fact statuses
say research required. Coverage does not establish verification.

Scientific joins match 130 current archive names directly. The workbook omits
scientific names for the two hybrids; its other mismatch is the redpoll taxon,
which requires a separate taxonomic review. No fuzzy scientific-name matching or
parental measurement inheritance is used. This follow-up publishes only the
existing five-taxon pilot: four biological profiles and an empty hybrid profile.

`dist/data/bird-facts.json` separates source metadata from UI. Each visible field
has a checked date, source URL, source section and verified status. Invalid or
missing facts fail closed without hiding historical statistics or photos. The
card adds weight, typical lifespan, longest BTO ringed record and selected
historical nicknames, with expandable source links. The original maximum-age
column is never relabelled typical lifespan. Exact ringed durations were checked
rather than treating decimal values such as 8.42 as months.

Verified biological sources:
- https://www.bto.org/learn/about-birds/birdfacts/robin
- https://www.bto.org/learn/about-birds/birdfacts/swallow
- https://www.bto.org/learn/about-birds/birdfacts/mallard
- https://www.bto.org/learn/about-birds/birdfacts/peregrine

Game weights and AVONET masses are different measures. Cards explicitly use the
BTO weight reference: Robin 19 g, Swallow 19.9 g, Mallard 1,210 g. Peregrine's
workbook AVONET-derived 760 g is not presented as the BTO reference; BTO currently
gives 889.3 g. The workbook is unchanged. Typical life expectancy in BTO applies
to birds reaching breeding age; longest ringed records are not global maxima.

Historical nickname entries were checked in the public-domain H. Kirke Swann
(1913) dictionary, Internet Archive identifier `dictionaryofengl00swanrich`, using
its full-text transcription. Published entries are RUDDOCK and ROBIN for Robin,
CHIMNEY SWALLOW, MIRE DUCK and CLIFF HAWK. These establish British regional or
historical usage, not local borough usage. Other workbook names remain withheld.
Source: https://archive.org/details/dictionaryofengl00swanrich
Text: https://archive.org/download/dictionaryofengl00swanrich/dictionaryofengl00swanrich_djvu.txt

No workbook game rarity score, AVONET migration class, unverified narrative fact
or other unreviewed metric was copied into the cards. No full-catalogue expansion,
push, merge or deployment is included in this follow-up.

Follow-up validation: **124/124 tests pass**. Browser checks at 1440px and 390px
also confirm the new facts, expandable/collapsible source links, decoded image,
keyboard wrapping, Escape/Close, focus and scroll restoration, hybrid placeholder,
and no page/card overflow or JavaScript errors. Syntax and whitespace checks pass.

## Expanded factfile follow-up (28 October 2026)

The existing five-taxon pilot now includes identification (with age/sex differences
where sourced), diet, general UK habitat and a short memorable fact for the four
verified species. These are newly checked summaries from the linked RSPB species
guides, not a blanket publication of workbook research. Exact source sections,
checked dates and URLs remain alongside each field. The hybrid inherits none.

UK conservation labels explicitly name **BoCC5 (2021)**. Robin, Swallow and
Peregrine are Green; Mallard is Amber. There is a source discrepancy: the RSPB
Mallard page currently says Not assessed, whereas BTO BirdFacts and the original
BoCC5 Amber list agree. The dated BTO assessment is the displayed authority;
the RSPB label is not copied or silently resolved into an undated claim.
Assessment: https://www.bto.org/sites/default/files/publications/bocc-5-a5-4pp-single-pages.pdf
These are UK categories, not global IUCN status or borough rarity scores.

Measurements, historical names, lifespan and nesting/clutch/call information move
under More details. Nesting and dimensions are shown only where checked; omitted
values are not inferred. Swallow identification contrasts the House Martin's
white rump. The RSPB species guide and BTO recording/ID page are linked; no
unlicensed audio is copied or embedded. Additional similar-species comparisons,
local habitat recommendations, month-by-month borough likelihood and global IUCN
labels remain deferred pending evidence. Borough migration classifications are
still withheld. The guide links preserve the old generic RSPB search separately.

`bird-card-context.mjs` prepares display-only reporting information. Recent ranks
use the existing ranking validator and READY/fingerprint gate, followed by exact
reconciliation of all 133 historical identities/counts/dates/ranks. Its 365-day
archive window is visible. It does not invent a live rolling rank or trend.
First archived dates are taken only from this matching release.

Latest public eBird reports are selected across the existing borough and Wetland
feeds by exact scientific name and greatest valid observation date. Only locations
in the feed's public-hotspot directory are included; nearby/private/unknown
locations, future dates and unmatched taxa are excluded. All tied public location
names are retained, sorted and deduplicated. Only date, names and feed timestamp
reach the display object. Observer, checklist, coordinates and raw reports are
never copied into card context. Feed snapshot time and incomplete-coverage wording
are visible. No network call to eBird or ingestion/refresh change is introduced.

Latest snapshots for this review: Robin and Mallard at WWT London Wetland Centre,
27 October 2026; Swallow at that hotspot, 14 September; Peregrine there, 23 October.
These are latest reports in the loaded feeds, not latest sightings anywhere.
They are computed at page load rather than committed as fixed card facts.

Validation: **131/131 Node tests pass**. New tests cover public location selection,
ties/deduplication, scientific identities, future/malformed dates, private-location
exclusion, privacy-safe display objects, exact ranking reconciliation, dated
conservation metadata, missing context and escaped values. Desktop/mobile checks
at 1440px/390px verify expandable facts/sources/reporting, decoded photos, keyboard
wrap including summary controls, Escape/Close, focus/scroll restoration and no
horizontal overflow or JavaScript errors. A FAILED-metadata preview withholds
recent rank while keeping independent verified facts available. JavaScript syntax
and `git diff --check` pass. No push, merge, deployment or full image expansion.

## Complete listing (28 October 2026)

`dist/species.html` provides the complete 133-taxon public universe, including both
hybrids. It is linked from Recorded Species and offers name/scientific/nickname
search, rank/name/latest-report sorting, modal card buttons and a full CSV download.
The table separates last archived date from latest public report date/location(s),
and exposes the feed timestamp and the recent ranking window. Horizontal table
scrolling stays inside a labelled keyboard-focusable region on narrow screens.

Current coverage: **133 taxa; 94 with latest public-hotspot locations; 39 without a
matching report in the loaded feeds; 4 with verified nicknames/biological factfiles**.
The 60 workbook nickname candidates have not all been verified. The complete
listing does not publish those candidates, expand the photo library or imply
complete biological profiles. Missing conservation/nickname values say awaiting
verification. Missing report data does not mean absence. Historical archive
location remains unavailable; the location column comes only from recent feeds.

`species-listing-data.mjs` defines the shared whitelisted row/CSV format, including
all verified biological fields, historical/recent rank periods and public location
provenance. `species-listing.mjs` loads the current public data at page load;
rankings still require a matching READY release. CSV downloads include all taxa,
even when the visible table has a search filter. No raw observation/observer/
checklist/coordinate data are exported.

A repeatable offline CSV export is available with:
`node scripts/export-species-listing.mjs /new/path/listing.csv`.
It requires a validated matching release, refuses to overwrite an existing file
and uses the same identity, location, fact verification and CSV formatter as the
page. The review export is `/private/tmp/hf-complete-species-listing.csv`.

Validation: **133/133 Node tests pass**, including full-universe/hybrid/count
reconciliation, missing fields, safe field selection and CSV quoting. Local browser
checks at 1440px/390px pass for 133 rows, location coverage, nickname search, card
opening/closing, retained filters, sorting, full CSV download, no document overflow
and no JavaScript errors. Syntax and whitespace checks pass. No production push,
merge or deployment was performed.

## Supplied nicknames and all public places

At the user's direction, the listing now includes the workbook's 60 nickname
entries without additional dictionary-entry checks. `bird-nicknames.json` retains
the workbook name/hash and explicit workbook-supplied status. These names are not
marked independently verified and are not evidence of local borough usage. Biological
fact verification remains unchanged. Cards show supplied nicknames beneath the
scientific name; the listing and CSV identify their source status.

Each species also has a Places reported section containing every public hotspot
represented in the loaded borough/Wetland feeds, deduplicated by location name,
with its latest report date. The table exposes these as expandable lists, and CSV
includes all places/dates. Existing exact identity and public-directory/privacy
filters apply to every report. This is recent-feed coverage, not historical archive
distribution. Latest report remains separately available. No private locations,
observers or checklist data are added. No production publication is authorized.

## Saved review inputs and export

The supplied working workbook is retained unchanged under `docs/source-workbooks/`.
It remains a research input with its original pending-review statuses; putting it
in version control does not mark every field verified. It is outside the Pages
`dist` directory. The current complete CSV snapshot is retained under
`docs/exports/hf-complete-species-listing-2026-10-28.csv`. This dated export is a
snapshot; the website's Download full CSV button uses the loaded current feeds.
Rebuild a new dated snapshot with `scripts/export-species-listing.mjs`.
All code, local WebP assets, photo evidence, manifests, source workbook, export,
validation scripts, tests and review documentation now live in the feature branch.

## Flight outlines (28 October 2026)

Three local, unmodified species-specific SVGs now appear in an In flight section:
Swallow (Hirundo rustica), Mallard (Anas platyrhynchos) and Peregrine (Falco
peregrinus). No generic substitute is displayed for Robin or other missing taxa.
The illustrated pose/perspective is labelled and outlines are not shown to scale.
The section uses a white panel for contrast with black transparent SVG artwork.

All three use CC BY-SA 3.0. The Swallow attribution retains Thermos (photo),
Jimfbleak (crop) and Nevit Dilmen (SVG); Mallard retains M. Buschmann (photo) and
Nevit Dilmen (SVG); Peregrine credits Liftarn. Source, licence and unmodified-file
statements remain visible. For Peregrine the original explicitly CC BY-SA licensed
file was selected instead of the combined image's public-domain-labelled derivative.

Sources:
- https://commons.wikimedia.org/wiki/File:Hirundorusticaflightcropped.svg
- https://commons.wikimedia.org/wiki/File:Anas_platyrhynchos_flying.svg
- https://commons.wikimedia.org/wiki/File:Falco-peregrinus-silhouette.svg

`bird-flight-outlines.json` separates catalogue metadata from presentation code;
selected-file Commons API evidence is retained in `docs/bird-flight-evidence/`.
SVG files are in `dist/images/flight/` (about 28 KB on disk combined). Original
source bytes are preserved; no repainting, cropping or SVG adaptation was made.
Files were parsed for script/foreignObject, embedded images and external/active
references, rendered on white and visually checked. The browser uses external img
elements rather than injecting SVG markup. Missing/invalid catalogue entries fail
closed to omission; an image-load failure removes the section.

Validation: **141/141 Node tests pass**. Tests cover licensed exact identities,
local assets/credits, unsafe paths, missing licences, unknown/hybrid/unverified
matches and missing-outline omission. Desktop 1440px/mobile 390px checks confirm
all three images decode, credits display, no horizontal overflow/JavaScript errors,
Robin's section is absent, and Escape restores focus. Syntax and whitespace checks
pass. Everything is committed on the feature branch; no push/merge/deployment.

## Production deployment scope

The deployment branch excludes the original working Excel file. It remains saved
only on the local feature branch; the earlier source-workbook preservation note
refers to that local branch. No source-workbooks directory or workbook blob is
included in this deployment history. The website uses the derived public catalogues,
not the original workbook. Deployment was explicitly requested by the user.

## Listing photograph visibility correction

The first complete-listing release showed names only; photographs required opening
a card. The listing now displays the four verified photographs directly alongside
species names, with creator, licence and source links. All other rows explicitly
say No verified photo. The introduction and coverage summary state the limited
four-photo coverage. Existing full-image card behaviour is retained. No new image
sourcing or full-library expansion is included. All 141 tests pass; desktop/mobile
listing checks verify four thumbnails, 129 missing-photo labels and decoded image
visibility alongside search/card/download regression checks.

## User-approved library expansion

The four-photo proof-of-concept coverage above is superseded by the user's manual
review export: 117 approvals and ten rejections. The approved library now contains
121 photographs across 133 taxa, with 12 placeholders (ten rejected and two hybrids).
See `docs/bird-approved-photo-library.md` and `docs/bird-photo-approvals.json` for
size, source/licence coverage, decisions and validation. Unreviewed alternative
candidates remain outside deployment; the original working workbook stays local.
