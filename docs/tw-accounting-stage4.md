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
- Freeze submitted financial values; withdraw an unposted submission before
  changing it. Preserve posted history and use linked reversals for corrections.
- Show posting and reversal status in both modules. Never treat an invoice posting
  as a payment, or automatically import historical receipts.
- Test permissions, duplicate/concurrent requests, stale snapshots, period locks,
  journal and customer balances, reversal, and cleanup on development only.

The first version accepts invoices in the company's base currency (Thinkway:
EGP). It refuses foreign-currency posting until an explicit exchange-rate workflow
is implemented. Revenue account selection is required for each invoice; the
accountant confirms the receivable and VAT accounts before posting. Zero-VAT
invoices generate two lines; taxable invoices generate three.

An invoice can be posted once. A reversal preserves the original invoice and
voucher and does not silently make the invoice eligible for a second posting.
Credit/debit-note processing is a later workflow. Existing invoice financial
immutability rules still apply after withdrawing an unposted submission.

Run `npx tsx --test features/accounting/invoice-model.test.ts` for exact preview
arithmetic. Run `scripts/test-tw-accounting-invoices.sql` and the Stage 3 journal
SQL suite through `scripts/psql-development.mjs`; both roll back every fixture.
The Stage 2 legacy Media RPC isolation audit is still required before production.
