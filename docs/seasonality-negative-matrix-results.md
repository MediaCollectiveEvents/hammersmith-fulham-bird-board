# Seasonality negative-test matrix

Date: 23 October 2026.
Scope: Priority 1 only. Initial findings below were measured against unchanged production logic at `d1f006e`; the final validation-fix results are recorded at the end. Metadata provenance is verified in the public board repository (`db12b38`, `2508645`). Upstream `birds-hf` provenance remains separate and unresolved.

## Execution

New file: `test/seasonality-negative-matrix.test.mjs`.

Each validator test builds a valid two-species synthetic fixture in a disposable temporary directory, applies its deliberate corruption, and runs the actual standalone validator. No private archive, production dataset or API is used. Metadata JSON/CSV are kept synchronized when testing another condition, preventing an unrelated representation mismatch from masking the intended result. The valid control passes.

The browser tests execute the actual `loadMigrationCalendar` function extracted from the unchanged HTML with fixture responses and assert both the exact fallback and that no calendar request occurs. Separate real-browser checks on disposable local copies also confirmed FAILED and INCOMPLETE display the fallback with zero seasonal rows. No deployed files were changed.

- New matrix: **29 tests — 26 passed, 3 failed**.
- Full suite: **47 tests — 44 passed, 3 failed**.
- The three failures are genuine unexpected acceptances, not skipped/TODO tests or redefined success criteria.
- Whitespace checks passed.

## Results

| Requirement | Result |
| --- | --- |
| Valid fixture control | Passed |
| Missing calendar species | Rejected |
| Unexpected calendar species | Rejected |
| Duplicate calendar species | Rejected |
| Blank calendar species | Rejected |
| Blank public-layer species (additional case) | Rejected |
| arrival_month = 0 | Rejected |
| arrival_month = 13 | Rejected |
| departure_month = 0 | Rejected |
| departure_month = 13 | Rejected |
| Non-numeric arrival month | Rejected |
| Resident with arrival month | Rejected |
| Resident with departure month | Rejected |
| Scarce / Irregular with arrival month | **Unexpectedly accepted** |
| Scarce / Irregular with departure month | **Unexpectedly accepted** |
| Invalid movement type | Rejected |
| Invalid confidence | Rejected |
| Missing audit row | Rejected |
| Low-evidence classification violation | Rejected |
| Change row old_value == new_value | Rejected |
| Duplicate non-no-op change rows | **Unexpectedly accepted** |
| Missing required metadata field | Rejected |
| Metadata schema type violation | Rejected |
| READY with failed validation | Rejected |
| FAILED with otherwise successful flags | Rejected |
| INCOMPLETE with otherwise successful flags | Rejected |
| Metadata species-count mismatch | Rejected |
| FAILED browser suppression | Passed, exact fallback, no calendar fetch |
| INCOMPLETE browser suppression | Passed, exact fallback, no calendar fetch |

Exact fallback:

> Seasonal guidance is temporarily unavailable while borough migration data is being rebuilt.

## Confirmed gaps

1. **Standalone Scarce / Irregular timing enforcement:** both arrival and departure are accepted when audit evidence is above the low-evidence threshold. Fixtures set confidence to Low, so the issue isolated here is timing. The low-evidence rule does not cover every Scarce / Irregular row. The generator has a separate timing rule; that does not make the standalone validator reject these mutated outputs.
2. **Duplicate change-report rows:** identical, genuinely changed rows are accepted. Metadata and summary change counters are reconciled to two rows, and the row is non-no-op, so no existing no-op/count check masks the missing uniqueness check. The duplicate identity policy needs to be explicit; this test requires rejection of exact duplicate rows at minimum.

These fixture failures do not show that the current production snapshot is corrupt. Existing production behavior, EBD authority, metadata/schema, reconciliation and publication logic were not modified. They show that the existing validator does not enforce the full requested contract on deliberately invalid inputs.

## Next narrowly scoped work

Review a separate fix for unconditional Scarce / Irregular timing rejection in the standalone validator and exact duplicate change-row rejection, retaining the failing tests as regression checks. Do not relax assertions or mark the gaps as passed. Input-schema/identity requirements and deployment-time gates remain later priorities, not changes in this work.

No new boards, ingestion, scheduling, workflow, source dataset, governance or publication changes were made. ADR-001 remains Active by owner direction, ADR-002 remains Proposed, and the reported upstream Issue #3 remains blocked/unverified. The initial test-only audit was not committed, pushed or deployed at that stage.

## Narrow validation fixes — 23 October 2026

Branch: `codex/seasonality-validation-fixes-20261023`.

The standalone validator now rejects arrival or departure timing for every Scarce / Irregular row, independently of the low-evidence rule. It also rejects exact duplicate change entries keyed by all five defined fields: COMMON NAME, field_changed, old_value, new_value and change_date. Existing no-op validation remains in place. Different values or change dates are not deduplicated by this check.

The original failing assertions were retained without relaxation. After these changes:

- Negative matrix: **29 passed, 0 failed**.
- Full suite: **47 passed, 0 failed**.
- Read-only validation of the existing production outputs against the available public CSV passed: public=133, calendar=133, zero missing/unexpected species.
- Whitespace checks passed.

The three earlier unexpected acceptances are resolved locally. No generator, schema, input requirements, metadata gate, workflow, API pilot, dataset, display or ADR changes were made. This candidate is being committed and pushed only for review; it has not been merged or deployed. Build-time validation and browser readiness gates remain present; deployment-time validation remains absent. The pending Recorded species display work remains in its separate worktree.
