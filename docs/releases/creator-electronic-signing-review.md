# Creator electronic signing — release review

This initial review is retained as history. See [the completed Dev validation report](creator-electronic-signing-dev-validation.md) for the current deployment, connected-test evidence and outstanding CI blocker.

Review date: 13 November 2026. This is a draft release candidate, not approval to merge or deploy.

## Business behavior

The creator opens **Review & Sign** from the IO email or their Creator Workspace, reviews the exact IO, enters their name, draws a signature and presses **Sign & Approve** once. There is no separate approval step. The result offers a signed PDF; confirmation emails attach those same PDF bytes. Email failure does not undo a completed signature and the page still offers a download.

Existing approved IOs are not retroactively signed. Client IO approval remains unchanged. A signed IO must be revised to change its commercial terms. Reopening a completed signing link returns its existing result rather than replacing the signature.

## Exact release boundary

Production baseline: `36e8dba370f57a516721bef63b7de782f0700609`.
Dev baseline: `c54db64bfba2c88c0691d7b29e946b7e1bb1a593`.
The 16-file signing implementation from `73edf7cdb88ec55712abfd8b025b99403bae9163` was cherry-picked onto the Production baseline, without merging develop or copying the dirty root workspace.

Additional changes are limited to signed-evidence protection, signing validation scripts and this review. `vercel.json` disables automatic deployment only for `codex/creator-signing-production-review`, to allow PR review without a preview deployment. Existing main/develop settings are unchanged. This uses Vercel's documented [branch deployment controls](https://vercel.com/docs/project-configuration/git-configuration).

Quotation labels, FX experiments, Discovery changes and workspace cleanup are excluded. Preserved work remains untouched.

## Security and storage

- Portal signing derives the authenticated creator identity on the server and checks ownership in the database. Email signing uses a hashed bearer token; possession of the email link grants access. It does not independently verify the signer's legal identity or add OTP/certificate-based signing.
- The session/signing RPCs are service-role-only. Anonymous callers cannot sign by guessing an IO ID; old unsigned approval RPCs are disabled.
- The database locks the IO during signing, checks token validity, expiry, supersession and document hash, then records signature, approval and audit event in one transaction. Replays do not replace the first signature.
- The private bucket stores a unique PDF path with overwrite disabled. The signature record retains source HTML, signed HTML, SHA-256 source digest, strokes, consent, signer name/email, timestamp, revision, IP/user-agent and portal actor when available. Downloads use expiring signed storage URLs (15 minutes by default).
- The review found that existing campaign-writer storage permissions could overwrite/delete signed files. The added restrictive policies reserve the signed folder for the server workflow. The updated trigger also freezes source HTML and the signed-PDF reference.
- These protections constrain application users. Privileged database/storage administrators and service credentials remain trusted; this is not infrastructure-level WORM storage. The digest records the source HTML, not an independently certified identity or a PDF checksum.

## Database dependencies and rollout coupling

Read-only checks confirmed Dev has `vendor_io_signatures`, `sign_vendor_io`, `get_vendor_io_signing_session` and `guard_signed_vendor_io_terms`; Production has none of them. Both already have the private `vendor-io-documents` bucket. Neither environment has the new restrictive signed-folder policies yet.

Required migrations, in order:

1. `20261111020000_vendor_io_electronic_signatures.sql`: signature table, grants/RLS, signing/session functions, atomic approval/audit and protection against unsigned legacy approval.
2. `20261113010000_vendor_io_signed_evidence_protection.sql`: restrictive storage policies and stronger signed-IO mutation guard.

Dependencies already present include vendor IO approval-token columns/hash helper, creator-to-profile mapping, campaign/vendor IO authorization, notification table, Supabase service-role configuration, private document storage, Chromium PDF rendering and email delivery configuration. No dependency or lockfile change is included.

The application and migration must be coordinated: the new application requires the new table/RPCs, while the first migration disables approval through old application endpoints. Do not apply an indiscriminate migration backlog. Do not drop signature records or restore unsigned approval as an automatic rollback. If a deployment fails after migration, pause new signing and repair forward while preserving evidence.

## Validation and limits

Local PostgreSQL tests apply the actual two signing migrations to a disposable minimal fixture schema and roll back test records. They cover access/ownership, expiry, supersession, stale documents, legacy bypass attempts, atomic signature/approval/audit, idempotent replay, immutable terms/source/PDF reference, signed-folder INSERT/UPDATE/DELETE denial and continued unsigned-file writes. This is not a rehearsal of every existing Supabase policy and trigger.

The real server action is exercised in 11 scenarios with real local Chromium PDF generation and controlled external services. It verifies invalid/unauthorized input, rate limiting, stale documents, successful upload and attachment byte parity, storage failure, stale-hash failure after upload, uncertain commits, email failure and repeat access. Database/storage/email doubles are explicit: these tests do not demonstrate network delivery to real recipients.

The real React form is tested in headless Chromium with desktop mouse and mobile touch input, including blank-signature prevention, retry after a simulated connection failure, preserving entered name/strokes, and the completed PDF link. Submission is intercepted. This is a component-browser test, not a connected Dev end-to-end test.

The related Creator Workspace, vendor terms/document parity, lifecycle, approval-register and email suites are run against the lockfile dependencies. One campaign-navigation assertion also fails on the unchanged Production baseline: Finance/Performance out-of-band labeling while at Client IO. It is outside this signing release and remains pending.

Results: **197/198 regression tests pass**, with that one baseline failure; **11/11 action scenarios pass**; **2/2 browser scenarios pass**; both local SQL suites pass; standalone TypeScript and scoped ESLint pass. The full **Next.js 16.4.4 webpack build passes** using placeholder Supabase configuration, with a BullMQ dynamic-dependency warning and existing dynamic-render logging. Lockfile dependencies were installed in this isolated worktree because the root's older Next.js installation is not a valid release-build baseline.

Reproduce the new focused checks from the candidate root:

```text
node scripts/test-vendor-io-signing-local.cjs
node scripts/test-vendor-io-signing-action.cjs
node scripts/test-vendor-io-signing-browser.cjs
```

The SQL harness needs Docker/PostgreSQL 16; the PDF/browser harnesses need installed Chrome or Edge. They use no shared database credentials and send no real messages. Original root workspace counts remain 241 modified tracked files and 167 untracked entries.

The read-only Dev evidence query found **zero stored signature records** at review time. Therefore there is no retained Dev signature/PDF/audit chain to use as evidence of a completed connected workflow. The Dev end-to-end gate below is explicitly outstanding; passing isolated tests does not substitute for it.

## Release gates

Keep the PR in draft until the validation result summary is reviewed. No merge, shared database migration or deployment is authorized by this review.

After separate authorization, verify the hardened candidate on Dev before any Production release: apply only the missing protection migration to Dev, deploy the candidate, run a synthetic creator email-link and authenticated-portal workflow against real Dev storage/audit, confirm the downloaded PDF and access isolation, and exercise delivery success/failure through a controlled mail sink. Retain the signed test evidence. Verify a signed IO revision and unchanged Client IO approval/campaign progression.

Only after that Dev gate passes should Production receive both targeted migrations and the application release, with post-release checks and a forward-repair plan. No production data backfill is required by these migrations.
