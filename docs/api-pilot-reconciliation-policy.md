# Proposed API pilot reconciliation policy

Status: working proposal for pilot evaluation only — not adopted.
Date: 22 October 2026.

This document does not revise either ADR, introduce ingestion, or authorize publication. ADR-001 remains the reported active operational model; ADR-002 remains Proposed. The policy applies to future isolated API candidate evaluation, not mutation of the preserved baseline.

## Rules

1. **Baseline preservation.** Never change the source baseline. Keep API evidence and proposed changes separate, with provenance and timestamps. The new local SHA-256 snapshot is a checkpoint, not historical-integrity proof.
2. **Exact repeats.** Identical records with the same key are duplicates, not additions. Track fetched/accepted rows separately from unique additions, updates and unresolved conflicts.
3. **Same-key changes.** Record the previous value and candidate value in private pilot evidence. An update may replace the candidate value when the identity is unchanged and the source evidence is valid. This does not grant automatic publication or establish general identity stability.
4. **Date/key changes.** Treat a possible identity-changing correction as unresolved. Do not silently count both records as distinct observations, overwrite a different observation, or guess a match. Species/date/location/checklist changes require evidence of their relationship. Do not assume the composite key or checklist ID identifies an immutable individual observation. Keep the conflicting candidate out of any accepted union until reviewed; retain prior evidence without silently modifying it.
5. **Missing records.** Absence from a recent/limited API response is not deletion evidence. Retain the prior record with an unresolved freshness question; do not imply it was reverified. A deletion needs independently confirmed source evidence and a recorded review decision. No automatic deletion from endpoint absence.
6. **Bounded coverage claims.** Record query time, geography, lookback, filters and result limits. Distinguish intentionally excluded records, possible truncation and independently evidenced omissions. Do not describe recent feeds as a complete historical archive.
7. **Failure and recovery.** Failed or incomplete runs must not replace accepted outputs or trigger publication. Rate-limit retries are distinct from multi-day outage catch-up. Require observed reference records and an agreed recovery window to test catch-up. Request-failure preservation does not prove atomic-write or crash safety.
8. **Evidence and privacy.** Keep raw responses, observer names and location information private. Public summaries should use aggregate outcomes and non-sensitive provenance. Never include API credentials. Do not create fabricated public checklists or edit real observations for a software test.

## Offline evidence against the unchanged updater

See `tests/api-pilot-offline.test.mjs` and `api-pilot-results-and-test-plan.md`. The six synthetic characterization tests use no real network or key.

| Rule area | Existing evidence | Remaining gap |
| --- | --- | --- |
| Duplicate handling | Identical rows collapse to one key | Accepted-row counter misleadingly says new reports |
| Same-key update | Synthetic count correction replaces the prior count | No live identity-stability guarantee; no correction audit trail |
| Date/key change | Synthetic changed date leaves old and new records | Updater does not flag/quarantine this conflict; proposed rule is not implemented |
| Missing/deleted row | Previous record retained | No independent deletion evidence or freshness/review state |
| Failed request | Previous output byte-identical | No mid-write/crash or real outage-recovery proof |
| Rate limit | One synthetic 429 retries successfully | No evidence for historical completeness or catch-up after long interruptions |

Passing these characterization tests includes confirming known limitations. It must not be presented as policy conformance or permission to adopt ADR-002.

## Gate before implementation or additional live studies

- Owner reviews the proposed treatment of unresolved conflicts and stale records.
- Establish an authoritative pilot project/maintainer and private evidence location.
- Identify authorized independent reference checklists and a bounded study plan.
- Define measurable acceptance thresholds before collecting evidence; do not invent thresholds from a successful smoke test.
- Obtain separate authorization for implementation, further live calls or any candidate-union work. Keep all such work separate from production and the baseline.

No scheduled polling, account settings, ingestion automation, production dataset, workflow or publication changes are authorized by this document.

## Offline review prototype — 23 October 2026

`pilot/review-candidates.mjs` is an isolated, pure review classifier. It is not imported by the site or updater, has no I/O, and cannot construct an accepted union or publish data. Eight synthetic tests cover duplicate counts, same-key update review, checklist-overlap identity warnings, absent records, conflicting responses, invalid inputs and non-mutation. Together with the six existing updater characterization tests, 14 focused tests pass.

The prototype deliberately holds all additions and updates for review. A shared checklist is only a possible relationship, not proof of identity; changing a checklist ID can remove even that signal. Records without such overlap remain new-record review candidates, not accepted additions. Missing rows are labelled unverified, not deleted. No production correction handling has been fixed by these tests, and live completeness remains unproven.
