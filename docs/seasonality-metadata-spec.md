# Seasonality metadata and cross-field validation specification

This specification adds build metadata, audit visibility, and publication readiness checks to the Expected-board seasonality outputs. It does not change the seasonality calculation methodology.

## Metadata outputs

Generate both files for every successful seasonality build:

- `seasonality_metadata.json` is the authoritative machine-readable build record.
- `seasonality_metadata.csv` contains the same fields and values as a one-row table for review and spreadsheet use.

The JSON structure is defined by [seasonality_metadata.schema.json](../schemas/seasonality_metadata.schema.json). The `generated_at` value must be an ISO 8601 date-time. Source names should be basenames, not local absolute paths.

The metadata records the calendar and methodology versions; archive and public-layer source names; public and calendar species counts; two-way reconciliation counts and status; arrival/departure, resident, scarce/irregular, and confidence totals; data-quality flags; change counts by field; validation status; and Expected-board readiness.

`expected_board_status` values:

- `READY`: generation and all critical validation checks passed.
- `FAILED`: generation ran, but at least one critical check failed.
- `INCOMPLETE`: generation was skipped or did not produce a complete result.

## Cross-field validation

The seasonality validator checks the metadata against the JSON Schema and applies the cross-field business rules below. It must record the outcome in `seasonality_validation.csv`; species-specific review items belong in `seasonality_audit.csv`.

Keep the existing summary columns in `seasonality_validation.csv` and add the metadata reconciliation counts, change counts, quality flags, `expected_board_status`, and a semicolon-separated `issues` field. Keep the species-level audit fields and add a reserved `COMMON NAME=__BUILD__` row for build-level cross-field issues. This records both the result and the species or build condition requiring review.

### Species boundary and confidence

- `public_species_count` equals `calendar_species_count`.
- `PUBLIC_SPECIES − CALENDAR_SPECIES` and `CALENDAR_SPECIES − PUBLIC_SPECIES` both contain zero names. Record their sizes as `missing_from_calendar` and `unexpected_in_calendar`; `reconciliation_passed` is true only when both are zero.
- Confidence totals add up to `calendar_species_count`.
- If `validation_passed` is true, reconciliation must pass and duplicate, invalid-month, invalid-movement-type, and invalid-confidence flags must all be false.
- Residents remain in the calendar but must have blank arrival and departure months. Scarce / Irregular rows must have Low confidence; blank arrival/departure months are recommended and any violation must be flagged for review.

Species that do not appear on arrival or departure boards are still present in the calendar. Movement-board eligibility does not change the public species universe.

### Timing and coverage

- For a nonblank `arrival_month`, require `earliest_month <= arrival_month`.
- For a nonblank `departure_month`, require `departure_month <= latest_month`.
- For Summer Visitor, Winter Visitor, Passage Migrant, and Partial Migrant rows, flag a blank arrival or departure month for review unless confidence is Low.
- `generated_at` must exist and parse as a valid timestamp.

### Change accounting and methodology version

- `changes_detected` equals `arrival_changes + departure_changes + movement_type_changes + confidence_changes`.
- Track confidence changes along with arrival month, departure month, and movement type.
- If `methodology_version` differs from the previous build, require at least one recorded change and a `seasonality_changes.csv` metadata row documenting the old and new methodology versions.
- Use a reserved `COMMON NAME=__METADATA__` entry with `field_changed=methodology_version` for the methodology change record.

### Readiness status

- When `validation_passed` is true, `expected_board_status` must be `READY`.
- When validation fails, set `expected_board_status` to `FAILED` and fail the build.
- If the generation step is skipped, set `expected_board_status` to `INCOMPLETE`; do not publish a new calendar.

Critical failures include species reconciliation, duplicate species, invalid months, invalid movement types, invalid confidence values, confidence coverage mismatch, change accounting mismatch, invalid generation timestamp, resident timing, invalid arrival/departure chronology, and validation/status dependency failures.

## Publication gate

The refresh step may publish `species_migration_calendar.csv` only when all of these are true:

- `reconciliation_passed` is true.
- `validation_passed` is true.
- `missing_from_calendar` and `unexpected_in_calendar` are both zero.
- Duplicate species and invalid month, movement-type, and confidence flags are false.
- `expected_board_status` is `READY`.

Otherwise, fail the refresh and keep the Expected board from displaying the invalid or incomplete calendar. Its fallback message is:

> Seasonal guidance is temporarily unavailable while borough migration data is being rebuilt.

## Required output set

The refresh build produces all six files:

1. `species_migration_calendar.csv`
2. `seasonality_validation.csv`
3. `seasonality_audit.csv`
4. `seasonality_changes.csv`
5. `seasonality_metadata.csv`
6. `seasonality_metadata.json`

Place the published calendar and metadata under `dist/data/`. Keep the archive in the private build area. The metadata JSON is the source of truth for the board readiness check; the CSV is for review.
