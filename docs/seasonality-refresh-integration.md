# Seasonality refresh integration

This document distinguishes the seasonality pipeline available in this board repository from the upstream source refresh project. It does not present the source project's `refresh.sh` or DuckDB scripts as executable from this checkout: neither is included here.

Metadata fields, cross-field business rules, and publication readiness are specified in [seasonality-metadata-spec.md](seasonality-metadata-spec.md), with the JSON structure defined in [seasonality_metadata.schema.json](../schemas/seasonality_metadata.schema.json).

## File locations

The upstream archive, public classification layer, and DuckDB outputs should remain in the private source/build project. The board repository writes the four seasonality CSVs under `dist/data` for the site's static reporting layer.

| File | Location | Published? |
|---|---|---|
| `hf_ebird_records_final.csv` | `$ROOT/hf_ebird_records_final.csv` | No |
| `excluded_taxa.csv` | Existing input path used by `rebuild_public_layer.sql` | No |
| `birds_hf_public.csv` | `$ROOT/birds_hf_public.csv` | Keep in private build area; seasonality eligibility input |
| `borough_stats.csv` | `$ROOT/borough_stats.csv` | Copy to `dist/data/borough_stats.csv` if the site consumes it |
| `borough_summary.csv` | `$ROOT/borough_summary.csv` | Copy to `dist/data/borough_summary.csv` if the site consumes it |
| `homepage_features_display.csv` | `$ROOT/homepage_features_display.csv` | Copy only if the site consumes it |
| `homepage_hero_species.csv` | `$ROOT/homepage_hero_species.csv` | Copy only if the site consumes it |
| `species_migration_calendar.csv` | `$BOARD_DIR/dist/data/species_migration_calendar.csv` | Yes; Expected board input |
| `seasonality_validation.csv` | `$BOARD_DIR/dist/data/seasonality_validation.csv` | Yes; build report |
| `seasonality_audit.csv` | `$BOARD_DIR/dist/data/seasonality_audit.csv` | Yes; review report |
| `seasonality_changes.csv` | `$BOARD_DIR/dist/data/seasonality_changes.csv` | Yes; change report |
| `seasonality_metadata.json` | `$BOARD_DIR/dist/data/seasonality_metadata.json` | Yes; authoritative readiness metadata |
| `seasonality_metadata.csv` | `$BOARD_DIR/dist/data/seasonality_metadata.csv` | Yes; human-readable metadata |

Keep `hf_ebird_records_final.csv` and any coordinates or observer fields in the private build area. The seasonality build writes the calendar, validation, audit, change, and metadata outputs under the board repository's `dist/data` directory.

## Upstream public-layer requirement

In the upstream source project, keep the existing species filters and exclusions unchanged. Make the final public species export path explicit and stable so the seasonality build can use that file as its eligibility boundary. In the existing `COPY` statement that exports the validated public species relation, use:

```sql
COPY (
    SELECT *
    FROM <existing_validated_public_species_relation>
    ORDER BY "COMMON NAME"
)
TO 'birds_hf_public.csv'
(HEADER, DELIMITER ',');
```

Replace `<existing_validated_public_species_relation>` with the relation already produced by the upstream SQL workflow; do not add another species-filtering implementation. The existing `COPY` statements for `borough_stats.csv`, `borough_summary.csv`, `homepage_features_display.csv`, and `homepage_hero_species.csv` should write to the same private build directory. Before that SQL step completes, retain or add its public-layer checks for nonblank names, unique common names, and count-equals-distinct-count. Do not put `hf_ebird_records_final.csv` in `dist`.

## Seasonality integration in this repository

The seasonality build assets exist in this repository and can be run from this checkout. From the board repository root, run:

```sh
npm run build:seasonality -- /path/to/hf_ebird_records_final.csv /path/to/birds_hf_public.csv
```

This command runs the existing generator and validator. It produces:

```text
dist/data/species_migration_calendar.csv
dist/data/seasonality_validation.csv
dist/data/seasonality_audit.csv
dist/data/seasonality_changes.csv
```

## Repository boundary and upstream integration point

The source project that owns the archive refresh is not available in this checkout:

```text
Upstream source project (not in this checkout)
├── refresh.sh
└── DuckDB refresh SQL

Board repository (this checkout)
├── seasonality build pipeline
└── dist/data reporting outputs
```

The upstream `refresh.sh` should invoke `npm run build:seasonality -- <archive> <public species CSV>` after the public species CSV has been generated and validated, then publish the resulting seasonality CSVs with the board. This is an integration point for the upstream refresh; it cannot be run end-to-end from this board repository alone.

```text
Upstream refresh → validated public species CSV + archive → seasonality build → board outputs
```

### Current repository layout

The seasonality pipeline can be run from this board repository, but the upstream orchestration cannot. The source project containing `refresh.sh`, the DuckDB database, and its refresh SQL is not part of this checkout. Do not present the upstream refresh sequence as executable here or add a second, standalone refresh process to this repository.

Run the existing downstream build from the board repository root:

```sh
npm run build:seasonality -- /path/to/hf_ebird_records_final.csv /path/to/birds_hf_public.csv
```

The current build generates these four CSVs under `dist/data`:

```text
species_migration_calendar.csv
seasonality_validation.csv
seasonality_audit.csv
seasonality_changes.csv
```

These may be imported by the board reporting workflow. That import alone does not make the Expected board ready; it remains gated on valid metadata as described below.

## Metadata validation gate

> **Current status:** The current checkout can generate the four seasonality CSV outputs, but that is not sufficient to produce a board-ready Expected dataset. The upstream refresh process and metadata generation are external dependencies. Until both required metadata artefacts (`seasonality_metadata.json` and `seasonality_metadata.csv`) are produced and successfully validated, treat the Expected board as unavailable.

The metadata specification and schema exist, but the current seasonality build does not generate these metadata artefacts. Metadata validation is therefore unavailable; the build must not claim that the Expected board is ready.

Once the metadata generator is connected, validate the metadata only when both files exist. If either is missing, keep the build marked incomplete and do not publish a READY status. A missing metadata file is not a successful or skipped readiness check:

```sh
if [ -s "$DATA_DIR/seasonality_metadata.json" ] && [ -s "$DATA_DIR/seasonality_metadata.csv" ]; then
    run_metadata_validation
else
    echo "Metadata outputs not available; seasonality readiness is INCOMPLETE and the Expected board remains unavailable."
fi
```

The board currently loads the Expected calendar only when `seasonality_metadata.json` reports `expected_board_status: READY`, `validation_passed: true`, and `reconciliation_passed: true`. Without that metadata, the board displays its temporary-unavailability message; skipping the metadata check does not enable calendar publication.

## Current supported workflow

1. In this repository, run `npm run build:seasonality -- <archive> <birds_hf_public.csv>` after the upstream process has created and validated both inputs.
2. Confirm the four CSV outputs exist and pass validation.
3. Import the outputs through the existing board/site workflow as needed.
4. Keep Expected-board readiness `INCOMPLETE` and the calendar unavailable until metadata generation and validation are implemented upstream.

### Readiness matrix for this checkout

| Readiness check | Status | Evidence |
|---|---:|---|
| Seasonality CSV generation available | ✅ | `npm run build:seasonality` runs the existing generator and validator. |
| Seasonality CSVs imported into the published board | ❌ | No seasonality outputs are currently present in `dist/data`; a successful build alone does not confirm publication. |
| Metadata generated | ❌ | `seasonality_metadata.json` and `seasonality_metadata.csv` are not generated by this checkout. |
| Metadata validated | ❌ | The metadata cross-field validation step is not executable here. |
| Expected board available | ❌ | The board requires READY metadata before it loads the calendar. |

Treat generation, import/publication, metadata generation, metadata validation, and board availability as separate checks. Do not mark the Expected board ready based only on successful CSV generation.

## Publication outputs for the Expected board

The static board fetches `./data/species_migration_calendar.csv` relative to `dist/index.html`. It first reads `./data/seasonality_metadata.json` and renders the calendar only when `expected_board_status` is `READY`. Otherwise it displays: “Seasonal guidance is temporarily unavailable while borough migration data is being rebuilt.” The four generated CSVs are not sufficient to pass this gate; publish metadata JSON and CSV alongside them once those files are produced and validated. Ensure the site's publication step includes the files under `dist/data`.

The SQL outputs `birds_hf_public.csv`, `borough_stats.csv`, `borough_summary.csv`, `homepage_features_display.csv`, and `homepage_hero_species.csv` remain in the private source/build directory by default. Copy only approved outputs that the site actually consumes into `dist/data` after validation and before the existing Pages publication step. Never copy the raw archive or `excluded_taxa.csv` into `dist`.

## Checks for the current build

```sh
npm --prefix "$BOARD_DIR" run build:seasonality -- "$ARCHIVE" "$PUBLIC_SPECIES"
npm --prefix "$BOARD_DIR" run validate:seasonality -- "$PUBLIC_SPECIES"
test -s "$BOARD_DIR/dist/data/species_migration_calendar.csv"
test -s "$BOARD_DIR/dist/data/seasonality_validation.csv"
test -s "$BOARD_DIR/dist/data/seasonality_audit.csv"
test -s "$BOARD_DIR/dist/data/seasonality_changes.csv"
```

The validator requires the calendar's names to match the current `birds_hf_public.csv` exactly, rejects duplicate or blank public names, verifies output files and allowed values, and fails the refresh on errors. It does not use a fixed expected species count.

The species-boundary reconciliation must pass in both directions:

```text
PUBLIC_SPECIES MINUS CALENDAR_SPECIES = 0 rows
CALENDAR_SPECIES MINUS PUBLIC_SPECIES = 0 rows
```

The validator reports these two differences separately. `Scarce / Irregular` species remain rows in the calendar so the species universe stays aligned; their arrival and departure months are blank, so they do not appear on either movement board. Classification does not create an exception to species-set equality.
