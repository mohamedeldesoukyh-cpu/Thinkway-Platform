# Creator electronic signing — Dev release-readiness report

13 November 2026 — PR #12 remains **draft / not ready to merge**. Connected Dev signing validation passed. The signing-specific CI job passed. The existing required `validate` job fails in an unchanged quotation-export test, so the condition for marking the PR ready has not been met.

## Business outcome

The creator can use the email link or their authenticated Creator Workspace, review the IO, enter their name, draw a signature and press **Sign & Approve** once. Dev testing confirmed that the signed document is retained, downloadable and included unchanged in both confirmation-message attachments. A revision receives a separate signature without replacing the original evidence.

No test messages were delivered to creators, clients or Traffic. Confirmation messages were captured privately at the transport boundary. This verifies message contents and PDF attachments, not acceptance or delivery by an external mail provider.

## Deployment and database

- Final Dev: `dev.thinkwaymedia.com`, Preview deployment `dpl_FYUgcy8orwaGeb1UoYX2yh599bHJ`, source `bd8fedd525a98e786d5d38bec7ba60538d6cca65`. Later validation/report-only commits do not change that application code.
- Connected test deployment: `dpl_HEoxm5pF7KiANFfYVxojBSG98zyH`, source `a32e97d7`, with capture enabled and real mail transports disabled. The final deployment restores inherited project mail settings and explicitly disables capture; a final signed-page smoke check passed.
- All five existing signing/legacy-approval function bodies matched the reviewed original signing migration before changes. Its migration-history entry was absent, so verification used actual function definitions rather than assuming history was complete.
- Applied **only** `20261113010000_vendor_io_signed_evidence_protection.sql` to Dev, transactionally, and recorded that migration. No original signing migration replay, unrelated migration, backfill or Production migration was executed.
- Production remains deployment `dpl_FMykdv4wt8yYSYvcmsvh7d7fRNY9`. Remote `main` remains `36e8dba3`; remote `develop` remains `c54db64b`. PR #12 was not merged.
- Existing Vercel protection remained enabled. Browser automation used the project's existing authorized automation access; application authentication and authorization were exercised normally.

## Connected verification results

| Area | Result |
| --- | --- |
| Email-link signing | Passed on deployed Dev with a synthetic unsigned IO; anonymous IO-ID access denied |
| Creator Workspace | Passed real login with a synthetic creator, confirmed the workspace's Review & Sign link, and signed using mobile touch input |
| PDF and storage | Valid PDF generated, privately stored and downloaded; downloaded bytes equal stored bytes; signed contents rendered for visual review |
| Confirmation messages | Two captured confirmations per signature; each attached PDF equals the stored signed PDF byte-for-byte |
| Audit and identity | One signed approval event per IO; original source hash, timestamp, revision and appropriate portal actor retained |
| Duplicate signing | Reopening shows the existing result; a replayed signing RPC cannot change the original record or PDF |
| Access restrictions | Other creator denied by both the signing page and signature-table access; authenticated caller cannot invoke service-only signing RPC; public PDF access denied |
| Immutability | Campaign writer cannot overwrite/delete signed PDF or change signed HTML, PDF reference, amount or signature evidence; ordinary unsigned PDF writes still work |
| Link/document edge cases | Invalid, expired and superseded links denied; legacy unsigned approval RPCs refused; changing the document after review rejects submission without creating a signature |
| Signed revisions | Existing revision service created revision 1, retained the original signature/PDF, generated a new document and required a fresh signature; new revision signed successfully on Dev |
| Document download API | Authenticated download of the original IO after revision returns the exact original signed PDF |
| Client IO | Existing token approval RPC succeeded without a creator signature; its approval page recognized the result; approval remained intact after vendor revision/signing |

The revision service and document generator were invoked as the synthetic staff user against real Dev data, followed by signing through the deployed browser flow. This verifies the existing service path; it is not a click-through test of every internal campaign editor control.

## CI and local checks

- Signing CI: `creator-signing` passed, including signature/document/confirmation regressions, the guarded Dev capture and the actual migrations in disposable PostgreSQL. No deployment capability is granted to this workflow.
- Required general CI: `validate` failed at `features/quotations/export/quotation-document.test.ts:1511`. Reproduction on the unchanged Production checkout fails at the same assertion. No quotation code or test was modified and no check was skipped or weakened.
- Prior release-candidate checks: full Next.js 16.4.4 build, TypeScript and scoped lint passed; 197/198 related regressions passed. The separate campaign navigation assertion also reproduces on Production and remains outside signing.
- The added capture test and scoped lint passed. Both Dev deployments built successfully. The capture transport rejects non-Dev, Production and non-synthetic requests when enabled, and is inactive by default.
- A later CI run exposed a disposable-PostgreSQL readiness race: the initialization server briefly accepts Unix-socket connections before restarting. The harness now waits for the final server over container-local TCP with a bounded timeout. This changes test startup only; no shared database or application behavior is changed.

## Retained evidence and resolved test setup failures

Fixture run: `20261113-3759aeda`; synthetic campaign: `4b7b385c-ab84-45ff-83cd-321e26bcccfb`. Three signed records are retained: email IO, portal IO and the new revision. The original email IO is superseded, not deleted. Six captured confirmation messages and their attachments remain in private Dev storage.

Local evidence is retained in `C:/thinkway-platform/artifacts/electronic-signing-dev-20261113/`, with a SHA-256 manifest. It includes workflow/security reports, signed PDFs, browser screenshots, PDF renders, revision-service evidence, migration output and failed-attempt records. Credentials and bearer tokens are excluded from this evidence bundle and from Git.

Four synthetic accounts were disabled after testing; their profiles, creator records, campaign, IOs and audit evidence were retained. No preserved local files or worktrees were cleaned or deleted.

Resolved setup issues are recorded rather than hidden: the first browser attempt encountered Vercel protection; the harness was corrected to use existing authorized automation access. The initial synthetic email token used a different hash from the application's existing helper; only unsigned test-fixture tokens were corrected. Test-mail capture was adjusted to use the bucket's existing HTML/PDF MIME allowlist rather than changing storage policy. Restricted service-role table privileges were respected by using the synthetic staff's existing permissions or the Dev-only SQL runner for fixture setup/verification; no grants were broadened.

## Release decision and remaining action

**Do not mark ready, merge or deploy to Production while required CI is red.** Resolve the quotation-export failure in a separately scoped change, or obtain explicit scope to investigate it, then rerun the required checks on PR #12. The signing implementation itself has passed the connected Dev gate; external email-provider delivery was deliberately not exercised.

Production still needs separate approval for the coordinated application release and these two targeted migrations, in order: `20261111020000_vendor_io_electronic_signatures.sql`, then `20261113010000_vendor_io_signed_evidence_protection.sql`. Do not replay a migration backlog. Preserve signed evidence on rollback and prefer forward repair; the old unsigned-approval endpoints are deliberately disabled by the first migration.

Email links remain bearer credentials and signatures are drawn acknowledgements, not OTP/certificate-based identity verification. The private storage and database protections constrain ordinary users; privileged administrators/service credentials remain trusted.
