# Creator electronic signing — controlled Production release plan

Status: preparation only. Production merge, migrations and deployment require separate user approval. The quotation CI correction is a separate develop PR (#13); signing remains PR #12.

## Scope and release gates

Release only the reviewed signing implementation, its two migrations, security hardening and supporting tests. The quotation correction updates assertions for the already-deployed November 9 fee layout; it changes no rendering or calculations. Keep quotation-label experiments, FX experiments, Discovery tests and preserved local work out of this release.

Before execution, pin the approved PR #12 commit, require successful Validate and Creator signing validation checks, and verify its application files match the Dev-validated implementation. Record the current Production deployment and database migration state again; the earlier baseline is main 36e8dba3 and deployment dpl_FMykdv4wt8yYSYvcmsvh7d7fRNY9. Confirm current backup/PITR availability, export the affected function/policy definitions, and retain the deployment and migration evidence securely.

## Database prerequisites and exact migration order

Verify the Production target explicitly (Supabase project ienowhwfyxoqtzbgltno), the existing vendor IO schema, token hash helper, private vendor-io-documents bucket, and existing authorization dependencies. Inspect actual schema/functions as well as migration history. Do not infer completion from history alone or run the unrelated migration backlog.

1. `20261111020000_vendor_io_electronic_signatures.sql`: signature evidence table and read restrictions; validated service-only signing function; signed-document access; guards against modifying signed terms; replacement of legacy vendor approval endpoints so they cannot bypass signing.
2. `20261113010000_vendor_io_signed_evidence_protection.sql`: restrictive authenticated storage policies for the signed namespace and the stronger signed-terms/PDF-reference guard.

Both files were exercised together in disposable PostgreSQL. Dev already had the original signing implementation, whose function bodies were verified; only the protection migration was applied there. Production needs both. After approval, apply these exact reviewed files in order in a controlled transaction with stop-on-error and migration-history recording, after checking for pre-existing objects. Verify policy/function definitions and privileges after commit. Do not apply broad privilege grants or change bucket visibility.

## Coordinated application rollout

The first migration intentionally disables legacy unsigned vendor approval calls, so this is not an independently deployable database change. Prepare and validate the exact application artifact first. Use a short coordinated release window, with signing temporarily unavailable if necessary, to apply the migrations and promote the approved application immediately afterwards. Never temporarily restore unsigned approval to bridge the window.

Production must have the normal mail configuration; SIGNING_DEV_EMAIL_CAPTURE must be absent/off. Verify private PDF storage, server-side PDF generation and required server credentials without exposing them. Confirm the existing Dev deployment remains the validated reference. After promotion, check email-link and Creator Workspace entry points, authenticated access restrictions, historical signed-document downloads and Client IO approval behavior. Any synthetic Production signing or email delivery tests require an agreed internal-only recipient and explicit release-test scope; never send test messages to real creators or clients.

Monitor signature creation failures, PDF upload/download errors, confirmation delivery failures and audit events. Retain deployment identifiers, migration results and smoke-test evidence. A successful signing must have one immutable signature record, matching document hash and stored PDF, with confirmation attachments matching those PDF bytes.

## Rollback and forward repair

- Before database commit: any migration error rolls back the entire targeted transaction; do not deploy the application. Investigate and validate the corrected migration on Dev first.
- After migrations but before any signatures: prefer fixing or redeploying the validated signing application. A previous UI deployment is not a full rollback because legacy vendor approval RPCs now reject unsigned approval. If the old UI must be restored for an unrelated availability issue, keep signing unavailable until repaired and retain the evidence schema and protections.
- After signatures exist: never drop signature tables, delete signed objects, overwrite signed HTML/PDFs, reopen signed IOs, restore unsigned-approval functions, or restore an old whole-database snapshot over new evidence. Preserve the signature records, hashes, audit history and original PDFs. Pause affected signing submissions if needed; retain downloads and unrelated workflows where safe.
- Forward repair: reproduce the failure on Dev; use a focused additive migration or application correction, rerun signing/security/Client IO tests, and obtain approval for the Production repair. For document/terms changes, create a new IO revision requiring a fresh signature; do not mutate the signed original. For confirmation failures, resend the existing stored PDF through the approved delivery path rather than generating replacement evidence.

## Known limits

Connected Dev tests verified real signing, PDF generation/storage/download, immutable audit evidence, revisions and Client IO compatibility. Email messages and exact attachment bytes were captured privately; external provider acceptance and inbox delivery were not exercised. Email links are bearer credentials, and drawn signatures are acknowledgements rather than OTP/certificate identity verification. Privileged database/storage administrators remain trusted.
