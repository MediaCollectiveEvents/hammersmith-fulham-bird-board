# API pilot: smoke-test results and remaining evidence

## Scope and provenance

Recorded 22 October 2026. The owner manually ran an exact copy of the board updater from commit 2508645 in a private local sandbox. The key was entered privately into a temporary shell environment; this review did not inspect or retain it. No automation, production data-path change or publication was introduced. ADR-001 remains the reported operational model and ADR-002 remains Proposed; neither ADR is revised here.

Sandbox: `~/Desktop/birds-hf/pilot/manual-20261022T224842Z`.

## Completed smoke test

- Owner-provided terminal output reports three rate-limit retries followed by success. This is evidence of recovery from rate limiting during this run, not a measured outage-recovery test; no HTTP trace was captured.
- Output timestamp: 2026-10-22T22:50:11.978Z.
- Independently read seed and output: 202 records each; 202 unique existing-updater keys; zero additions, removals, changed records or duplicate keys. All 202 seed records were preserved.
- Output spans 10 September–16 October 2026 and identifies 13 borough hotspots.
- The updater reports 144 accepted hotspot results, zero accepted other-location results and 626 nearby candidates. The counter labelled “new reports” counts accepted results, not unique additions. Zero accepted nearby results does not establish absence of eligible records.
- The copied updater is byte-identical to the repository source. Desktop archive and public-layer SHA-256 values remain unchanged from the newly recorded baseline snapshot.

This demonstrates a successful authenticated refresh and unchanged retained output against this seed. It does not demonstrate complete coverage, correction handling, backdated-record capture or outage recovery. A single unchanged refresh is not a general proof of idempotency or record-identity stability.

## Revised dependencies

The owner successfully supplied an authorized key for this one manual run. The historical “key unavailable” blocker is therefore resolved for that run only; no persistent runner secret or reusable key availability has been verified. Never request or publish credentials in issues or commits.

The public board repository is accessible. Identification/access for a separate authoritative upstream `birds-hf` project remains unresolved. Its reported Issue #3 / PR #4 could not be verified; HTTP 404 is an access/identity limitation, not evidence of deletion. Board #3 is a different, already-merged PR.

## Remaining test plan — manual, isolated, no publication

### 1. Coverage and limits

Identify the exact endpoints, query bounds, lookback, result limits and privacy/approval filters from the current updater. Compare results against independently authorized reference checklists for the same dates and geography. Separate eligible missing records from intentionally excluded ones and endpoint latest-per-species limitations. Record denominators, time windows, limits reached and unavailable reference data. Do not claim completeness when a reference cannot be obtained or a limit may truncate results.

### 2. Identity and corrections

Use authorized existing checklist evidence and repeat snapshots around a known legitimate correction; do not fabricate or alter public observations for testing. Compare species, date, location, checklist ID and changed fields. Determine whether the composite key changes and whether old entries remain. Include deletion behavior. A correction/deletion not actually observed remains untested. Separately use synthetic offline fixtures to test code behavior, clearly labelled as simulations rather than live API guarantees.

### 3. Late and backdated records

Track a legitimate, independently evidenced submission whose observation date predates its submission. Record when it first becomes API-visible and whether the configured lookback captures it. Assess older-than-window observations separately; do not imply the recent API reconstructs history. Preserve timestamps and aggregate outcomes without exposing observer names, private locations or raw response bodies publicly.

### 4. Recovery and replay

First simulate network failure and rate limiting offline in a disposable sandbox, checking failure leaves the previous output intact. Any live recovery study must be manual and separately authorized, using timestamped snapshots across an agreed interruption/window and a known reference dataset. Measure missing records and catch-up limits. Do not deliberately disrupt production, schedule polling, or equate a short rate-limit retry with a multi-day outage test.

### 5. Candidate compatibility and decision

Only after identity/coverage evidence is sufficient, assess mapping to required baseline/public-layer fields and terms of use. Any candidate union or end-to-end pipeline test needs explicit separate scope and private outputs. Keep the baseline immutable by process, preserve last production outputs, and do not adopt ADR-002 or introduce archive ingestion merely because the smoke test succeeded.

## Evidence handling

Keep raw pilot outputs and personal/location information private. Record hashes, dates, aggregate counts, source commit, endpoint configuration and clearly labelled limitations. The snapshot hashes establish a new checkpoint only; no earlier historical checksum manifest was found. Nothing in this document authorizes scheduled workflows, production updates or another live API run.

## Offline characterization results — 22 October 2026

Six synthetic tests passed against the unchanged updater. The harness replaces fetch before importing the updater, refuses unrecognized URLs, supplies a fake token without inheriting the user's environment, and uses disposable temporary output files. No eBird or other network requests are made by these tests.

| Scenario | Observed behavior | Interpretation |
| --- | --- | --- |
| Duplicate response rows | One retained key; accepted counter counts both rows | Key deduplication works for identical inputs; counter is not unique additions |
| Correction with unchanged key | Updated count replaces previous count | Same-key field updates work in the synthetic scenario |
| Corrected observation date | Both old and new dates remain | Key changes leave stale prior entries; correction reconciliation is incomplete |
| Missing/deleted record | Previous record remains | Endpoint absence is not treated as deletion; this is expected for limited recent feeds but cannot prove archive freshness |
| Network exception before output write | Nonzero exit; output bytes unchanged | Previous output survives this request-failure scenario; mid-write/crash safety was not tested |
| One 429 then success | Retry completes; one output key | Synthetic rate-limit recovery works; not proof of outage catch-up |

These are characterization tests, including assertions of known limitations, not six assertions that the API archive design is ready. No production fixes were made. Date/key corrections and deletions need an explicit reconciliation decision and live/reference evidence before ADR-002 can be considered. Coverage, late/backdated submissions and multi-day recovery remain unproven.

## Reference checklist comparisons — 23 October 2026

The owner supplied two checklist links for read-only comparison. Browser display names were matched by species code, not assumed to be identical to API/common-name normalization.

- `S401617421`: five of five species and all counts match the saved manual-pilot output (six individuals total), with date 12 October 2026 and hotspot ID matching. This establishes one checklist-level match, not complete hotspot coverage.
- `S404187501`: one Jay dated 21 October 2026 was absent from the manual-pilot output. A separately owner-run diagnostic completed at 2026-10-22T23:13:15.038Z (23 October, 00:13 BST). Its captured geo/recent response returned HTTP 200 and included the target with `obsValid=true`, `inBorough=true` and `locationPrivate=true`. The unchanged updater explicitly excludes private locations from its nearby-observation path. The target remained absent from output; 202 records were retained. Three captured 429 responses were followed by successful retries. No endpoint errors remained.

The second result is an explained privacy-filter exclusion in that diagnostic run, not evidence of an API failure or an eligible missing record. Browser visibility of the checklist does not override the API location-privacy flag. Preserve the filter. No additional API requests were made while reading the saved diagnostic.

The diagnostic cannot establish what responses or privacy flags existed during the earlier manual run. It does not prove complete coverage, correction/deletion handling, backdated capture or outage recovery. Further coverage references should be known non-private, eligible observations, without asking owners to change privacy settings for the test. Exact coordinates and observer details are deliberately omitted from this summary; diagnostic files remain local.

## Additional coverage references — 23 October 2026

Read-only browser comparisons with the saved manual-pilot feed established:

- `S394148064`, Wormwood Scrubs LNR, 19 September 2026: the checklist displays 27 species; four records are retained under that checklist ID (Chaffinch 1, Whitethroat 1, Jay 2, Whinchat 1), all matching the displayed species codes/counts. The other 23 species are not represented under that ID. The checklist predates the 22 October run's configured 30-day lookback and all four matches were already present in the seed. This demonstrates partial historical retention, not new capture or proof of an in-window omission.
- `S401264359`, Wormwood Scrubs LNR, 11 October 2026: all 17 species-code/count pairs match, totaling 73 individuals. Date and hotspot ID also match. This is within the configured lookback; records were present in the unchanged seed/output, so it verifies snapshot representation rather than first-capture timing.

Combined reference outcomes: two fully matched checklists, one privacy-filter exclusion explained for the diagnostic run, and one older checklist partially retained. These are selected examples, not a statistically representative sample or proof of borough-wide completeness. The existing recent/latest-observation queries and retained feed must not be described as a lossless checklist archive.

No additional API requests or checklist edits were made for these comparisons. No further ordinary checklist sampling is required to restate these findings. Progression now needs a bounded, separately authorized study with legitimate correction/late-submission evidence and recovery references. Do not alter public checklists simply to manufacture test cases. Correction identity, deletion reconciliation, backdated capture and multi-day outage recovery remain unproven; ADR-002 remains Proposed and production stays unchanged.
