# Stage 5 — Invoice receipts and collections

Accounting records full or partial receipts against original posted invoices.
It uses the existing Media `payments` and `payment_allocations` records and PAY
counter. A receipt created in Accounting updates Media's balance in the same
transaction as its journal. Existing completed Media receipts appear in the
Accounting queue and are posted without creating a second payment.

Select an active cash/bank posting account in class 11. Receipts use the invoice
currency and the system exchange rate on the receipt date. The journal shows
foreign and base amounts. Cash uses the receipt rate; the customer credit uses
the invoice's saved carrying value. Realized gains/losses use selected accounts
(starter defaults 712001 / 722001), with base-only lines. Cumulative allocation
clears the final local cent on the last partial receipt.

Posting requires Accounting management access, MFA, an open period and a fresh
preview. Accounting-only staff use narrow financial RPCs without Media table
access. Source invoice/payment locks serialize collection and posting; request
IDs and unique payment/journal links make retries idempotent. Overpayments are
blocked at the database for Accounting-linked invoices. Automatic journals and
posted source payments/allocations cannot be edited through manual or Media
flows. Invoice unposting/reversal is blocked while completed receipts remain.

Reverse erroneous receipts from Receipts & collections with a date and reason.
This posts opposite lines at the original saved rates, cancels the shared
payment, removes its allocation and restores Media's invoice balance. Original
and reversal vouchers remain in the audit trail. This is correction of an
erroneous receipt, not a customer cash refund. Reversed receipts cannot be restored;
record a new corrected receipt. No hard deletion occurs in normal workflows.

Coverage updates run at transaction end after invoice balance and existing Media
RPC updates. They aggregate all active invoice slices for affected deliverables.
The older application-level sync skips Accounting-linked invoices to preserve
the aggregate. Open browser tabs can use Refresh to load updated shared data.

Scope: invoice receipts only, in the invoice's currency. Advances and advance
allocations are visibly excluded from posting until their liability-account
workflow is implemented. Cross-currency settlements, refunds, bank matching,
supplier payments, and credit/debit-note accounting remain subsequent work.

Validation: `scripts/test-tw-accounting-receipts.sql` runs in a rolled-back dev
transaction, covering FX gains/losses, final rounding, Media-to-Accounting posting,
Accounting-only collection, reversals, retries, source locks, overpayment, stale
previews, closed periods and MFA/read-only access. Re-run Stage 3 and Stage 4 SQL
regressions. Preview tests: `npx tsx --test features/accounting/receipt-model.test.ts`.
Every update is deployed and verified on development before any live release.
