# Brand/client integrity — 13 October 2026

## Production data correction completed
Al Baraka Bank (BRD-14) was attached to Bundle Plus Communication by the first-client default. It is now linked to Essencemediacom, verified in both the database and the Brands register. The transaction checked every inbound foreign-key dependency, locked against concurrent writes, and changed only client_id (the existing database trigger synchronized the group). There were no dependent records. No campaigns, quotations, invoices, or rates were edited.

## Pending application patch
- New brand and group brand creation start with no client selected; submission requires a valid client. Creation from an explicit client context continues to use that client.
- Brands register: Change client with destination confirmation; only unused brands can move.
- Brands register and client profile: typed-name Delete confirmation. Server permission/MFA checks plus invoker-rights RPCs preserve RLS.
- Database triggers block deletion or reparenting when any foreign-key dependency exists, including CASCADE/SET NULL and RLS-hidden records. Concurrent child writes are serialized for these rare operations; contention fails safely.
- Existing broad brand edit cannot change ownership; the dedicated guarded action must be used.
- No bulk campaign reassignment or destruction of issued financial history is included. Existing references must be resolved through their supported workflows first.

## Validation
Passed: TypeScript (noEmit); 5 schema tests; targeted ESLint; synthetic PostgreSQL 17 migration tests for permissions, portal denial, privileged MFA, stale ownership, confirmation, campaign/CASCADE/SET NULL dependencies, RLS-hidden records, moves and deletes; two-session concurrent dependency test. Disposable local database stopped afterward.
The final migration SHA256 is 290E638AFBA456701E929A22511E04AE658E027DDE143FF9817F2CF488E5BB3B.
Production webpack build FAILED: unchanged client-workspace/components/proposal-summary-card.tsx imports security/review-token.ts, which imports node:crypto into the browser graph. BullMQ dynamic-import and webpack cache warnings also appeared. A separate untouched-baseline build was not run.
Full browser interaction, shared-dev migration verification, and release build remain outstanding. No test creates/deletes real client, campaign, or financial records.

## Release
Uncommitted isolated managed checkout. No push or deployment; migration not installed in shared databases. Keep the unrelated root redesign unchanged. Resolve the build blocker, apply/verify the migration on dev, then verify the UI on dev before any explicitly approved live release. Missing RPCs fail closed.

## Release preparation
Owner approved commit/push and dev-first production release. Extracted buildClientReviewPath into a browser-safe module; cryptographic validation remains unchanged. Six targeted tests and lint pass. The client-workspace suite has 213 passes and one mobile CSS source assertion failure reproduced on the unchanged baseline. Dev migration applied and checked using rollback-only temporary tables; anonymous calls denied and RPCs retain invoker RLS. No real records were deleted during validation. Local compilation and TypeScript pass; rebuilding with the approved dev configuration. Shared dev browser checks and production release verification follow the dev deployment.
