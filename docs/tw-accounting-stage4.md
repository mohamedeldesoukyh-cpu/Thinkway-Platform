# TW Accounting Stage 4 — invoice posting

Implementation scope: TW Media submits an issued invoice to a selected accounting
company. Accounting reviews the customer code, invoice amounts, posting date and
account mappings before posting one balanced voucher. Submission does not change
the general ledger. Receipts and payment allocation remain Stage 5.

Required controls:

- Retain the Media client UUID and existing client document code on the customer
  subledger line; never create one general-ledger account per customer.
- Persist the source invoice snapshot and a unique invoice-to-journal link.
- Check Media permissions and client/campaign scope at submission. Accounting-only
  staff see the submitted financial snapshot, without general Media table access.
- Require Accounting management access and MFA for posting and reversal.
- Validate the current source, currency, open financial period, account types,
  exact debit/credit equality, and duplicate requests in one database transaction.
- Freeze submitted financial values. Unpost an original invoice journal to
  correct its Media source; retain the voucher number and audit history.
- Show posting and reversal status in both modules. Never treat an invoice posting
  as a payment, or automatically import historical receipts.
- Test permissions, duplicate/concurrent requests, stale snapshots, period locks,
  journal and customer balances, reversal, and cleanup on development only.

Invoice journals retain the transaction currency and show its debit/credit amounts
beside the company-base amounts (Thinkway: EGP). The existing effective-rate
resolver selects the rate on the invoice date, including inverse/cross rates.
The posting saves that rate; subsequent master-rate changes do not alter it.
Missing rates and stale previews block posting. Local revenue and VAT are rounded
separately to cents; local receivables equal their sum. A nonzero foreign component
that rounds below one local cent is rejected explicitly.

Revenue account selection is required for each invoice; the
accountant confirms the receivable and VAT accounts before posting. Zero-VAT
invoices generate two lines; taxable invoices generate three.

An invoice retains one original journal. Accounting managers can unpost it with
MFA and a reason while its period is open. The journal becomes Pending, retains
its last posted lines and number, and is excluded from ledger/trial balances.
Media users with invoice write scope and finance.regenerate permission can then
un-generate the invoice, edit its operational source and regenerate it. The
invoice number is retained. Submitting the correction locks its financial values
again; reposting atomically replaces the same journal's lines and saves its new
rate. Old lines and transitions remain audited. Reposting must stay in the
original fiscal year to preserve the voucher number. Automatic journals cannot
be manually saved, cancelled or posted through the manual-journal API.

Unposting refuses reversed, cancelled, paid/partially paid, externally ERP-posted
or credit/debit-note-linked invoices. Reversals preserve the original FX rate and
swap both currencies' amounts. A reversal does not enable another posting.
Credit/debit-note processing remains a later workflow.

Run `npx tsx --test features/accounting/invoice-model.test.ts` for exact preview
arithmetic. Run `scripts/test-tw-accounting-invoices.sql` and the Stage 3 journal
SQL suite through `scripts/psql-development.mjs`; they roll back every fixture.
Run `scripts/test-tw-accounting-fx-corrections.sql` for dual-currency posting,
pending corrections, same-number reposting, rate snapshots and FX reversals.
The Stage 2 legacy Media RPC isolation audit is still required before production.
