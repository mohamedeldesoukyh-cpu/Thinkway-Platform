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


## Invoice allocation of credit and debit notes

In Media → Finance → Post to Accounting, choose a Client/Supplier CN or DN,
browse **Posted**, and open **Invoice allocations**. The table shows related-party
posted invoices in the note currency, original amounts, cash settled and current
outstanding. The original client invoice is marked. Enter full or partial amounts
and confirm Save allocations. Unallocated note balances remain separate in aging.

Credits reduce the invoice outstanding; debits increase it. Cash paid/received
remains unchanged. Receipts, payments and advances use the adjusted balance and
carrying amount. Statement descriptions include allocated invoice references and
amounts; the original note journal supplies the financial movement only once.
VAT remains in that original journal and is never added to accruals or reposted
by allocation.

To correct a linked document, clear and save its allocations first, then unpost,
edit, repost and allocate again. Removal of a debit allocation is blocked if
existing cash settlements/credits depend on it. Locks, closed periods, MFA,
company, party, currency, date, control account and version checks apply.
No historical invoices or note allocations are guessed or backfilled.

Current scope: same-currency invoices with compatible booked FX rates. Cross-
currency or different-rate allocation requires an explicit FX adjustment workflow;
this release rejects it rather than leaving an unexplained local balance.
Allocation is a current-balance linkage, not a new cash receipt or payment.

Migration: `20261128030000_tw_accounting_note_allocations.sql`, after the two
Media posting/accrual migrations. Additive allocation table with RLS, read-only
user table access, controlled write RPC and audit logging. Existing calculations
are extended in place; no business records, serials or balances are imported.
Recovery: withdraw the allocation UI and restore the backed-up function definitions
from the pre-install Dev snapshot; retain the allocation table and audit history.
If real allocations exist, stop and reconcile affected invoice balances before
reverting calculation functions. Do not drop or silently discard allocations.

Verification: `scripts/test-tw-accounting-note-allocations.sql` creates an isolated
company and rolls back all fixtures. Tests cover all four types, partial/full
allocation, aging residuals, note limits, MFA, locking, unposting dependencies,
full cash settlement and reversal, debit removal protection and statement refs.
`scripts/test-tw-media-posting-ui.mjs` tests the actual React components with
controlled HTTP responses; it is browser UI evidence, not a live authenticated
Dev end-to-end test.


## Platform entry and Accounting landing

The root URL opens the existing module chooser. The Media home dashboard is now
at `/media`; its navigation links and single-module login destination follow that
route. Existing module permissions and portal destinations are retained. Users
assigned only one module continue directly into their assigned module.
Accounting without a section hash opens a centered TW welcome screen. Toolbar
navigation chooses the workspace; explicit section links and refresh retain the
requested section. The posting queue uses existing Finance cards, controls and
table styling, with unused generic Export/Actions buttons hidden.
