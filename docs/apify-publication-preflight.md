# Historical Apify publication preflight

The backfill command is now **read-only in both environments**. There is no apply
mode and no Production write mode. It imports a pure planner and GET-only storage
reader, not a Supabase writer or actor runner.

Run only when separately authorized to access the chosen environment:

```text
node node_modules/tsx/dist/cli.mjs scripts/backfill-apify-rich-publication-evidence.ts --preflight --target=development --before=2026-09-15T00:00:00Z --explain
```

Production requires the literal `--target=production`, its exact configured URL,
and authenticated unrestricted read access. The reader accepts a service-role JWT
or opaque Supabase secret key, validates access through successful table reads,
and requires exact response counts. Ordinary user/anonymous credentials, empty
account visibility, failed reads, missing counts, and incomplete datasets fail
closed. Credentials are supplied through the existing environment; none are
printed. All requests use GET and refuse redirects. Do not run this command as
part of automated tests against a live environment.

## Read efficiency and request counts

The previous scan listed runs across all actors, then made two metadata GETs plus
`max(1, ceil(items / 1000))` items GETs per eligible run. Empty datasets still cost
three requests; shared dataset IDs were downloaded repeatedly. Sequential reads,
no retries and no checkpoints meant a late 502 lost the whole scan.

The observed 3,755 requests were attempts before failure, not a completed inventory
or the total required. That counter also included Supabase reads. The failed run
cannot establish an exact optimized Production request count.

The optimized reader lists only the configured actor's successful runs in
1,000-run pages, oldest first, with `startedBefore` fixed to the boundary. It still
applies the original `finishedAt <= boundary` filter and enumerates all pages.
There is no lookback limit, creator filter, sampling or top-N cutoff. Each unique
dataset is downloaded once in unfiltered JSON (`clean=false`), requesting 10,000
rows per page. Short server-capped pages continue at the actual returned offset
until the exact total. Missing counts, gaps, conflicting totals, duplicate run IDs
and dataset validation failures keep the final recommendation BLOCKED.

Expected requests, excluding retries and invalidated/corrupt caches:

| Dataset state | GET requests |
| --- | --- |
| Cold, one page (including empty) | 2: items + final metadata |
| Cold, multiple pages | item pages + 2 metadata checks |
| Complete cache, unchanged revision | 1 authenticated metadata validation |
| Partial cache, unchanged revision | remaining item pages + 2 metadata checks |

The first items response supplies the exact count, saving one metadata call for
single-page datasets. Multi-page downloads retain a revision check around the
remaining pages. A 25,001-row fixture costs five requests instead of 28. For an
illustrative 1,250 small unique datasets, dataset reads fall from 3,750 to 2,500
cold or 1,250 cached. Add one actor lookup, `max(1, ceil(actorRuns / 1000))` run-list
calls (assuming advertised capacity), and the unchanged Supabase table reads.
Concurrency reduces elapsed time, not request count.

## Reliability, progress and resume

- Four dataset workers by default (`--concurrency=1..8`); pages within each worker
  are sequential. On transport or unexpected failure, workers stop taking new datasets and drain before
  the preflight rejects, leaving no background reads after the report.
- 429, 5xx, network errors, timeouts and broken JSON receive up to four retries
  (five attempts total). Backoff starts at 1 second and doubles. Retry-After is
  respected up to 30 seconds; a larger hint stops the read instead of retrying
  early. Each attempt has a 60-second timeout. Other 4xx and redirects are not
  retried. Error bodies and authentication headers are never logged.
- Progress goes to stderr: request counts, retries, page offsets, cached rows and
  completed datasets, plus a heartbeat every 20 seconds. Final JSON adds
  `readStats`; planning and semantic counts are unchanged.
- Default cache: `.tmp/apify-publication-preflight-cache`, already ignored by Git.
  `--cache-dir=<directory inside repository>` selects another directory;
  `--no-cache` disables disk persistence. `--page-size=1..50000` changes page size
  without truncating coverage. Keep cached social data out of web-served folders
  and source control.

Checkpoints contain only Apify dataset rows, content hashes, page offsets, dataset
ID and selected `itemCount`/`modifiedAt` metadata. They never contain Supabase rows,
DNA, plans, environment variables, auth headers, or full Apify metadata (which can
include URL signing secrets). Known Supabase/Apify credentials appearing inside
dataset data are rejected before disk write, not silently redacted. Temporary
files and atomic rename keep partially written pages out of valid checkpoints.
Cache paths must remain in the repository; symlinks and junctions are refused.

After failure, use the same command with the same explicit `--before` boundary and
cache directory, only when live access is authorized. Run inventory and Production
tables are always freshly read. Cached datasets are authenticated and revalidated
against count and modification timestamp. Complete unchanged datasets reuse local
pages; partial datasets resume at the next offset. Missing/corrupt/stale cache
data is downloaded again. A 403/404 aborts the scan; failed validation is quarantined. Local data
never hides a missing remote dataset. No partial dataset reaches the planner.

Shared dataset rows are still normalized for every original run, preserving run
provenance and deterministic newest-run-first evidence order. Cache resume is a
download optimization, not a frozen database snapshot. The APIs do not provide a
transaction spanning all datasets and Supabase pages; concurrent mutation and
metadata propagation remain limitations. Observed inconsistencies block the
report, and no failed dataset is silently skipped.

API contracts: [actor run listing](https://docs.apify.com/api/v2/actors-runs-get),
[dataset page headers](https://docs.apify.com/api/v2/dataset-items-get), and
[dataset metadata](https://docs.apify.com/api/v2/dataset-get).

Offline validation uses fake transports and repository-local fixture caches:

```text
node --require tsx/cjs --test lib/creators/apify-preflight-scan.test.ts lib/creators/apify-publication-preflight.test.ts lib/creators/publication-evidence.test.ts
```

## Identity and scope

- Instagram only; successful retained runs of the configured Instagram actor.
- Account IDs come from account-linked Apify profile snapshots, with matching
  influencer linkage and profile-row username matching the snapshot's requested
  username. Database UUIDs, post IDs, coauthors and display names are not account
  identity evidence. No schema change is required.
- Stable account ID first; a unique normalized username is the fallback.
  Contradictory IDs, multiple account matches and historical username reuse are
  skipped and reported. Missing stored stable IDs remain a limitation of
  username fallback; they are never invented.
- Post IDs and canonical Instagram URLs reconcile URL-only and ID-bearing
  records. Shortcodes remain case-sensitive; tracking parameters and /p versus
  /reel aliases do not create a second publication. Conflicting IDs sharing one
  URL are skipped rather than combined.
- Dataset items are paginated to the declared count. Dataset validation failures,
  including changing counts or empty intermediate pages, are quarantined rather
  than produce a complete-looking partial report. Transport failures abort the
  scan. Rows outside the supported post shape are counted as invalid.

## Report and preservation

Account changes and DNA changes compare publication values, not timestamps or
the number of incoming rows. Publications enriched are distinct creator/post
identities with a value change in either destination, including newly added posts;
the two destinations are not counted twice. Unchanged counts are restricted to
matched records. Creator match skips are per input row; publication identity
issues are listed separately with their destination scope. `--explain` includes
proposed account arrays and DNA documents. `actualWrites` is always zero.

Planning never modifies input rows, raw snapshots, versions or lineage. Stronger
DNA values, envelope authority, confidence and existing history remain intact;
older publication evidence can fill missing values. Repeating the plan against
its proposed values yields zero semantic changes. The shared DNA writer also
omits absent raw snapshots and retains `last_snapshot_id` for evidence-only
merges; normal version/lineage inserts remain append-only. This writer is never
called by the preflight.

These safeguards do not authorize a live read or a future write. There is no
claim that paginated reads form a database transaction snapshot. A later write
implementation would require a separate reviewed plan and concurrency checks.

## Unresolved dataset quarantine

Dataset completeness/consistency failures are quarantined and scanning continues.
Validation is unchanged. No evidence from a quarantined dataset reaches planning,
including its cached partial pages and every run referencing the dataset.
Transport/authentication and unexpected failures still stop the scan and drain
active workers. Checkpoints are preserved; complete unchanged datasets remain
reusable after authenticated metadata validation.

The report separates `completeDatasetIds`, `quarantinedDatasets` (dataset ID,
all run IDs and validation reason), and `unresolvedDatasets`.
`evidenceScope: complete-datasets-only` applies to every evidence count, coverage
metric, proposed write count and optional plan. With any unresolved dataset,
`complete` is false and `recommendation` remains BLOCKED. Subset write counts
are not an exact estimate for the full historical inventory. Quarantine is
reported in JSON/progress, never saved as a completion or permanent skip marker.
