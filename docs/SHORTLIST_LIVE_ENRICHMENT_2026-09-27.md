# Shortlist enrichment progress

Pasted links previously triggered one route refresh after insertion. No watcher fetched the later enrichment results. The shared browse mapper also intentionally passes `hasInflightJob: false`, so a new queued creator could appear inactive even before that refresh.

This change is scoped to internal shortlists:

- Show each profile link as being added in the paste panel.
- Resolve pending shortlist jobs through the existing canonical queue/run status service.
- Show labelled queued/running spinners per creator, with reduced-motion support and accessible status text.
- Fetch active shortlist rows every three seconds, without overlapping requests, and patch profiles/metrics directly into React state. Completed rows stop polling; other creators continue independently.
- Retry transient connection failures with backoff and a visible message. Cancel polling and ignore late responses on navigation.
- Read status before creator data to avoid stopping on an older metrics snapshot at completion.
- The read action requires Discovery read permission, verifies shortlist visibility with session RLS and scopes all requested items to that shortlist. No service-role client, job creation, migration or data backfill is introduced.

Validation: TypeScript no-emit passed. Seven targeted tests passed, including per-creator completion, network recovery, cancellation, non-overlap, existing paste policy and canonical status resolution.

Release intent: development QA, then the same commit to production, as explicitly requested. Roll back to `463a07dc` if needed; no database rollback is required.
