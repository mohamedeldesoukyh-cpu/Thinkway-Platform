# Media posting and net cost accrual — Dev release

Media → Finance → **Post to Accounting** provides Client Invoices, Cost Invoices,
Client CN, Supplier CN, Client DN and Supplier DN. Browse a date range, select
individual documents or all eligible documents in the period, then confirm Post.
Each document is atomic; failures remain with their own error. A retry cannot
create a second journal. Posted view provides a reasoned Unpost operation.

Accounting → Settings → **Media posting mappings** controls automatic net cost
accrual. It is off by default. Enable it only after reviewing assignment cost,
usage-rights cost, accrued cost and their auxiliary mappings. Previously posted
invoices do not change when the setting changes.

## Accounting treatment

- Revenue invoice: debit client receivable; credit Revenue/Agency Fees/UR Revenue
  and actual output VAT, with the client identity on the VAT line.
- Enabled cost accrual: debit the mapped cost/UR cost, credit accrued costs.
  The estimate uses the saved billing proportion and assignment's **net** cost.
  It excludes VAT and every other tax. Costs already invoiced are not accrued again.
- Actual cost invoice: debit actual net cost and reviewed input VAT; credit vendor
  payable. Separate referenced lines debit accrued costs and credit the original
  accrued expense, only up to the matched remaining net cost. They use the original
  accrual's booked rate and identities. An excess actual cost remains an expense.
- Example: accrue 600; post a supplier invoice for 200 + 28 VAT. Clear 200 of the
  accrual, retain 400 accrued, and recognise the 28 VAT only in the supplier entry.
- Internal cost converted to an actual invoice: the adjustment shows the original
  cost/payable reversed at their original values, followed by the complete actual
  cost, VAT and payable. The net cost difference increases or restores clearing.
  A change from 100 to 120 + 16.80 VAT reverses 100 and records 120 + 16.80;
  only another 20 clears the accrual.
- CN/DN journals use their actual amounts and VAT. Credit notes reduce the relevant
  receivable/payable; debit notes increase it. Notes remain separate unallocated
  documents in aging and are included in GL/Third Party statements. Posting a note
  does not falsely mark it as a cash receipt or payment against another invoice.

Internal cost invoices have an assignment lookup so clearing has an explicit
source. If a supplier invoice belongs to an existing provisional cost, reconcile
that provisional document first. Posting the matching actual supplier document
then links the existing cost without duplicating it. Ambiguous or different
amounts are rejected for review.

Unpost preserves the JV number and sets the linked journal(s) pending. Repost
rebuilds the original JV at the current source values and retains its serial.
Previously posted supplier adjustments become pending with the original cost;
their historical serials and audit records remain reserved. Locks, closed periods,
payments, reversals and permissions remain enforced. A revenue invoice with a
consumed accrual cannot be unposted until its linked cost postings are unposted.

## Migration and recovery

Apply only to Dev for this release, in order:

1. `20261128010000_tw_accounting_cost_accruals.sql`
2. `20261128020000_tw_accounting_media_posting.sql`

Both are transactional, additive and contain guards checking the definitions of
existing functions before modifying them. No company settings are enabled, no
historical financial rows are rewritten and no fixtures are installed. New tables
have RLS, authenticated read-only grants, restricted RPC mutation and audit triggers.

Before application, capture the existing modified functions and journal pending
constraint. If a migration fails, its transaction rolls back; stop the release.
If application verification fails, restore the previous Dev application and keep
the additive schema and recorded financial data intact. Do not drop financial
tables or erase journals as a rollback. Review any new postings before restoring
old function definitions; restore from the captured definitions only when no new
posting depends on them. Production is excluded from this release.

## Verification evidence

- `scripts/test-tw-accounting-media-posting.sql`: isolated Dev transaction, always
  rolled back; six source types, internal costs, retries, stale tokens, pending
  transitions, stable JV serials, revised cost/VAT, partial clearing, reduced costs,
  prior recognised costs, balanced journals and source edit protection.
- `scripts/test-tw-accounting-component-auxiliaries.sql`: existing financial,
  auxiliary identity, VAT and mapping regression against the new functions.
- `scripts/test-tw-media-posting-ui.mjs`: unchanged real React component in controlled
  Chrome; six filters, select all, confirmation/cancellation, per-item failures,
  retry and unposting. HTTP responses are controlled; financial correctness is
  independently verified by the Dev SQL tests, not claimed from this UI harness.
- Standard typecheck, build, security, Accounting/Media regression and unchanged
  performance gates are required before the Dev alias changes.
