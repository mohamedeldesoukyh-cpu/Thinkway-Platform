# Stage 7 — Transaction controls

## Delivered scope

Transactions now includes **Journal approvals** and **Transaction locks & history**. Settings includes an administrator-only **Journal approval policy**. Cost centers remain excluded. Transfers, recurring journals and dedicated opening balances remain future workflow work; banking, financial statements/aging, budgets and closing follow separately.

The company policy defaults to **off**, as requested. Existing authorized users continue to post directly. An administrator can opt a company into independent approval, providing a reason. The policy applies to existing unposted manually authored General/Expenses journals and new ones. It does not reapprove historical postings or intercept automatic invoice, settlement, cost or reversal generation: those retain their existing source-specific authorization and posting checks.

## Approval workflow

1. Save a balanced draft in General JV or Expenses JV.
2. Open Journal approvals, review the account/auxiliary, currency, foreign/local amounts and description, then submit with a reason.
3. Another user with Manage accounting access reviews and approves or rejects it. Neither the creator nor the last editor can approve or reject their own journal. At least two accounting managers are needed when the policy is enabled.
4. Return to General JV/Expenses to post the approved draft. Approval alone does not post, allocate a voucher number, or affect balances.

Withdrawal returns submitted/approved drafts to an unapproved state. Content edits also clear approval, including account reclassification of draft lines. The database checks a fingerprint of the actual header and ordered journal lines before posting, so stale approval cannot authorize edited amounts or account identities. Refreshing a GL display name at posting is deliberately excluded from that fingerprint; account IDs, amounts, descriptions, currencies, rates, auxiliaries and Third Parties remain covered.

## Journal locks

Accounting managers may lock individual journals or an explicit selection on the current page. Administrators with verified MFA may unlock them. Reasons are mandatory. All selected journals must match the expected version and company; an invalid or stale selection rolls back the entire batch. UI selection is capped at the visible 50 rows; the API caps a request at 100.

Database triggers enforce locks on headers, lines and reversal creation. Locked journals cannot be edited, posted, cancelled, reclassified, unposted through their source invoice or reversed through receipt/payment workflows. The original entry and its balances remain intact. Repeating an already-completed posting request remains an idempotent no-op; it creates no new transaction. Unlocking does not reopen a period or waive approval, balance, currency, source-ownership or posting rules.

Locks are distinct from immutable posted status, approval status, period locking and fiscal closing. They do not freeze unrelated new transactions for the same Third Party or account.

## History and permissions

The existing `tw_accounting_audit` table stores policy, submission, approval, rejection, withdrawal, invalidation, lock and unlock events. The new viewer filters by company and optionally journal, with actor, action, reason and Cairo timestamp. No parallel audit table is introduced. General accounting readers see journal approval/lock status; detailed history retains the existing management/MFA boundary.

The existing module roles are reused. No user receives broader module access. Direct table writes to journals remain revoked. Approval-policy changes are guarded in the database as well as the API, including direct updates to the company table. Administrator policy changes require optimistic company-version checks; journal actions require optimistic journal-version checks and serialize on the company.

## Migration and compatibility

`20261126010000_tw_accounting_transaction_controls.sql` adds default-off company policy and journal metadata, four enforcement/read helpers, control RPCs and triggers. Historical journal lines, values, document numbers, statuses and balances are retained. `control_editor` is initialized from the original creator for existing journals and updated by subsequent content edits. The migration is applied to development only for this release.

The API at `/api/accounting/controls` uses existing Accounting context, MFA, CSRF and no-store responses. The existing journal editor displays lock/approval information and prevents posting buttons from offering an unapproved draft when the loaded company policy requires approval. Database enforcement remains authoritative if another user changes the policy after the screen loads.

## Validation

- `scripts/test-tw-accounting-controls.sql`: default direct posting; optional policy; rejection/resubmission; independent approval; content-edit invalidation; approved posting; locks; atomic stale-batch failure; administrator-only unlock/policy; reclassification/reversal guards; scoped history; read-only and MFA denial.
- Existing FX correction regression additionally checks that a locked automatic invoice journal cannot be unposted.
- Existing allocation regression additionally checks that a locked settlement journal cannot be reversed through the source workflow.
- All accounting SQL fixtures run only in development and roll back, including document counters and temporary module assignments.
- Unit tests cover request bounds, duplicate selection, single-journal review, explicit policy booleans, dates, filters and navigation permissions. Full CI validates build, types, application regressions and performance budgets before dev deployment.

Review URL: https://dev.thinkwaymedia.com/accounting. Production is not part of this release.
