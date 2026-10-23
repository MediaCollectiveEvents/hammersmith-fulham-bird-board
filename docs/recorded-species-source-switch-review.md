# Recorded Species source-switch review

Status: review candidate; not merged or deployed.
Date: 23 October 2026.

## Classification and provenance

Minor data-product change: the Recorded Species panel switches from NBN-derived data to eBird-derived archive aggregates and adds archive-based Last Recorded dates. It is not a UI-only release.

Old source: existing NBN Atlas occurrence export, retrieved 10 October 2026, described in the existing source notes as covering 2016–2025. Its JSON and credits remain unchanged and available in the repository. New source: existing validated Desktop public species layer plus its matching EBD-derived borough archive. The raw inputs are private and are not included. No API data is merged and no live requests are made.

Input SHA-256 values:

- `birds_hf_public.csv`: `0f186ea190b13d501928c84f139cea60b0d6bfe502517fd22b1b4791e770025d`
- `hf_ebird_records_final.csv`: `379427cd099f86a093a5fe4d7ce6c5640fcf71ae9e3af497ce95cd6939027d2c`

These newly measured hashes describe current bytes, not historical provenance proof. The exporter reconciles each public entry's count and first/last date with its archive records and requires one nonblank scientific name per entry. It publishes only common/scientific names, archive record count and latest archive observation date. No observers, checklist IDs, coordinates or raw records are exported.

## Data integrity and membership

- NBN: 129 taxon entries (121 species-rank, seven subspecies, one form).
- eBird public layer: 133 named entries, exactly matching the validated public CSV; 30,288 archive records belong to those entries. The full archive has 30,374 records; the other 86 remain outside this public set.
- eBird date range: 12 January 1963–28 September 2026. Last Recorded is the maximum archive observation date, not a live or definitive last sighting anywhere in the borough.
- The public layer includes two named hybrids. It also contains historical taxonomic category variation and a Redpoll entry represented as `issf` in this archive. No categories, names or input records were filtered/reclassified here. User-facing wording calls the 133 entries named taxa rather than claiming 133 strict biological species.
- Exact scientific-name comparison: 105 shared names, 24 NBN-only names and 28 eBird-only names. These are exact-name set differences, not an authoritative taxonomic crosswalk. Some represent subspecific or nomenclatural differences. No synonym matching or absence inference is invented.

### NBN-only exact scientific names (removed from this panel)

| NBN display name | Scientific name | NBN rank |
| --- | --- | --- |
| Lesser Redpoll | Acanthis flammea cabaret | subspecies |
| Razorbill | Alca torda | species |
| Alcedo atthis ispida | Alcedo atthis ispida | subspecies |
| Anas platyrhynchos x | Anas platyrhynchos x | form |
| Bar-headed Goose | Anser indicus | species |
| Water Pipit | Anthus spinoletta | species |
| Brent Goose | Branta bernicla | species |
| Barnacle Goose | Branta leucopsis | species |
| Dunlin | Calidris alpina | species |
| Treecreeper | Certhia familiaris | species |
| Ringed Plover | Charadrius hiaticula | species |
| Yellowhammer | Emberiza citrinella | species |
| Garrulus glandarius rufitergum | Garrulus glandarius rufitergum | subspecies |
| Glaucous Gull | Larus hyperboreus | species |
| Common Scoter | Melanitta nigra | species |
| Smew | Mergellus albellus | species |
| White Wagtail | Motacilla alba alba | subspecies |
| Pied Wagtail | Motacilla alba yarrellii | subspecies |
| Curlew | Numenius arquata | species |
| Southern Cormorant | Phalacrocorax carbo sinensis | subspecies |
| Pica pica pica | Pica pica pica | subspecies |
| Marsh Tit | Poecile palustris | species |
| Water Rail | Rallus aquaticus | species |
| Green Sandpiper | Tringa ochropus | species |

### eBird-only exact scientific names (added to this panel)

| eBird archive name | Scientific name | Last recorded |
| --- | --- | --- |
| Redpoll | Acanthis flammea | 2025-02-02 |
| Eurasian Sparrowhawk | Accipiter nisus | 2026-09-25 |
| Graylag x Canada Goose (hybrid) | Anser anser x Branta canadensis | 2026-05-18 |
| Richard's Pipit | Anthus richardi | 2007-09-23 |
| Short-eared Owl | Asio flammeus | 2022-10-29 |
| Common Pochard | Aythya ferina | 2025-12-14 |
| Eurasian Bittern | Botaurus stellaris | 2020-04-09 |
| Common Buzzard | Buteo buteo | 2026-05-02 |
| Ruff | Calidris pugnax | 2017-05-07 |
| Common Rosefinch | Carpodacus erythrinus | 2013-09-09 |
| Western Marsh Harrier | Circus aeruginosus | 2022-09-20 |
| Peregrine Falcon | Falco peregrinus | 2026-09-26 |
| Eurasian Hobby | Falco subbuteo | 2025-04-30 |
| Little Gull | Hydrocoloeus minutus | 2020-04-06 |
| Mediterranean Gull | Ichthyaetus melanocephalus | 2022-11-07 |
| Red-backed Shrike | Lanius collurio | 2017-09-23 |
| Great Gray Shrike | Lanius excubitor | 2010-10-11 |
| European Herring x Lesser Black-backed Gull (hybrid) | Larus argentatus x fuscus | 2020-11-14 |
| Yellow-legged Gull | Larus michahellis | 2025-11-27 |
| Common Nightingale | Luscinia megarhynchos | 2023-04-17 |
| Eurasian Wigeon | Mareca penelope | 2022-07-03 |
| Red Kite | Milvus milvus | 2026-06-16 |
| Black Redstart | Phoenicurus ochruros | 2026-06-21 |
| Common Redstart | Phoenicurus phoenicurus | 2024-04-16 |
| Rose-ringed Parakeet | Psittacula krameri | 2026-09-28 |
| Northern Shoveler | Spatula clypeata | 2026-01-24 |
| Sandwich Tern | Thalasseus sandvicensis | 2020-04-12 |
| Common Murre | Uria aalge | 1986-02-16 |

## Determinism and reproduction

Two independent invocations of `scripts/import-ebird-history.py` using the same private inputs produced byte-identical JSON. The committed candidate dataset was regenerated from that result. No wall-clock timestamp or random identifier is injected. Existing production source inputs and all six seasonality outputs remain unchanged.

Output SHA-256: `ba221bb2fa111f1bcff9b1d727a1faabaf1fcca88b0151f0276c7e74a405570d`.

## Isolation

No changes to seasonality generation/validation, metadata generation/validation, READY gate, scheduled updater, workflows, ADRs, API pilot or local refresh.sh. The existing NBN importer/data are retained for auditability. This adds a manually invoked exporter, not a scheduled export or publication process. The live site remains unchanged pending review.

## Review decisions before merge

The owner accepted the 133-entry count during review. The exact membership removals/additions and taxonomy wording remain explicit in this review record; acceptance of the total alone is not treated as an authoritative taxonomic crosswalk. Replacement of the NBN panel is an intentional source choice; it does not establish that NBN-only taxa were never recorded in the borough. No missing date is filled using API results, today's date or a guessed value. Data-use/attribution requirements for publishing this derived aggregate should be confirmed by the data owner; this review does not invent an EBD redistribution licence or claim legal approval.

This draft should not be merged merely as a display tweak. Accept the explicit source/membership change before release. Production remains on the prior source until an approved merge.
