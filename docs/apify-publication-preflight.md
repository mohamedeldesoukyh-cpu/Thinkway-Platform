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
- Dataset items are paginated to the declared count. Read failures, changing
  counts or empty intermediate pages abort rather than produce a complete-looking
  partial report. Rows outside the supported post shape are counted as invalid.

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
