# Production status and API pilot dependencies

Updated: 23 October 2026. See [pilot results and test plan](api-pilot-results-and-test-plan.md) for evidence scope and [proposed reconciliation rules](api-pilot-reconciliation-policy.md) for remaining decisions.

## Production

- Expected Board: live, as recorded in board Issue #1.
- Seasonality pipeline, metadata generation and schema validation: implemented in the public board repository. Current implementation was inspected at main commit `2508645`; metadata generation/schema validation were added in `db12b38`.
- Existing production metadata records 133 public species / 133 calendar species, zero missing/unexpected species, `validation_passed=true`, `reconciliation_passed=true` and `expected_board_status=READY`. Read-only comparison with the available public CSV confirmed the species sets match. This pilot review did not rebuild production.
- ADR-001 remains Accepted and operational per the owner's project status. ADR-002 (baseline plus API) remains Proposed only. Their authoritative upstream source/history has not been verified; neither ADR is revised here.

## Baseline and Phase 1 evidence

The owner originally reported Phase 1 baseline verification complete. Subsequent read-only inspection independently confirmed 30,374 archive records across 149 taxa, 133 unique public species, and 30,288 records belonging to that public species set plus 86 outside it. The archive's observation dates span 12 January 1963 to 28 September 2026; “October baseline” describes the snapshot/export, not October observations.

A new private baseline snapshot and SHA-256 manifest were created and copy-verified. No historical manifest was found for comparison: newly calculated hashes do not independently prove the earlier historical-checksum claim. Raw source files remain private and are not included in this change.

## API pilot progress and separate dependencies

1. **Authorized runner/key:** the owner privately supplied a key for two manual sandbox runs, both successful after rate-limit retries. The earlier key-unavailable blocker was resolved for those runs only; no persistent runner secret or continuing key availability was verified. No credentials were requested in chat, inspected, retained in pilot documentation or committed.
2. **Upstream identity/access:** the public board repository is accessible. The authoritative upstream `birds-hf` project/maintainer remains unidentified. Requests to the reported `MediaCollectiveEvents/birds-hf` Issue #3 and PR #4 returned HTTP 404. This is an access/identity dependency, not evidence of deletion. The available local `birds-hf` folder is not a Git checkout; the scratch folder is non-authoritative.

The public board's #3 is an already-merged, unrelated seasonality-validation PR. It was left unchanged. Upstream Issue #3/PR #4 were not updated or merged. Board Issue #1 records the pilot's initial findings and dependencies and remains open.

Two reference checklists match the saved feed completely; a third has an explained private-location exclusion in a captured diagnostic run; an older checklist is partially retained outside the recent-query window. These selected examples do not establish complete coverage. Fourteen offline tests characterize updater limitations and exercise an isolated review prototype; they do not establish live correction, backdated capture or outage recovery.

## Boundaries and next evidence

No API archive automation, production data-path changes, workflow changes or publication changes have been introduced. No dataset is included. The proposal/prototype is disconnected from the production updater and site.

Keep ADR-001 active and ADR-002 Proposed. Progress requires authoritative ownership, a bounded reference-based study and evidence for correction identity, deletions, late/backdated submissions and recovery. No production change or further API run is authorized by this record.
