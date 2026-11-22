# Stage 9 — Banking, reconciliation and payment preparation

## Banking

Bank account management links a named profile to an existing active cash/bank GL account, its optional shared/owned auxiliary and one enabled currency. The same GL can have different currency profiles. Duplicate GL/auxiliary/currency combinations are rejected. A profile with imported statements retains its GL, auxiliary and currency; its name, reference and active state remain editable. No account is opened with a bank.

Cash and bank movements show posted entries in the profile currency, LC debit/credit, document number and reconciliation status. Reports are paginated at 100 GL lines and export the explicitly labelled current page. Totals cover the entire selection, not just the page.

Bank reconciliation imports a strict portable CSV with `date,reference,description,amount` columns, YYYY-MM-DD dates and signed two-decimal amounts: positive receipts, negative payments. Quoted commas, newlines and escaped quotes are supported. Imports are limited to 2 MB / 2,000 rows. Opening balance plus imported movements must equal closing balance. Duplicate references/content and overlapping active statement date ranges are blocked. An incorrect unmatched import can be voided with a reason and replaced; its audit history remains.

Select 1–100 statement rows and 1–100 posted GL lines to match equal totals in the bank currency. This supports grouped deposits and payments without adding journal entries. Each GL line can belong to only one match. Old outstanding GL lines may match a later statement. Matched journal values, account/auxiliary identities, dates and posting status cannot be changed until the match is undone.

Closing requires every statement row matched and statement closing plus outstanding GL movements equal to the book balance. Later clearing dates remain outstanding when evaluating an earlier report date. Bank closing is separate from fiscal period locking. An administrator can reopen a closed reconciliation with a reason. Match, unmatch, void, close and reopen are audited using the existing accounting audit store and preserve management/MFA controls. New journal reversals remain separate movements to reconcile, rather than rewriting an earlier match.

## Payment preparation and cheques

Payment preparation reuses the existing vendor allocation editor. Save validates current allocations/rates but does not reserve invoices, allocate voucher numbers, create a payment or affect ledgers. A draft can be reopened and edited. Posting explicitly rechecks open invoices, the reviewed quote, auxiliaries and period controls through the existing settlement engine. Repeated successful requests return the same payment. Cancellation changes only the preparation status and records a reason. Posted vouchers remain available in Payments and General JV.

Ctrl+S in preparation saves the draft; posting uses the explicit reviewed-payment button. Normal receipt/payment posting is unchanged.

Cheque payments is a register of payments recorded with method `check`. The existing reference holds the cheque number. Clearing status comes from matched cash/bank lines; reconciliation does not create a second payment. Reversed vouchers remain identified. This records and tracks cheques; it does not print bank cheque stock, sign cheques or transmit payment instructions.

## Validation

- `bank-model.test.ts`: quoted CSV, signs, exact decimal totals, invalid dates, precision, malformed rows and row limits.
- `test-tw-accounting-banking.sql`: profile creation/edit, import arithmetic, overlap rejection, grouped matching, outstanding deposits, reclassification protection, close/reopen, role separation, audited undo/void and MFA.
- Existing allocation regression expanded for preparation save without posting, stale versions/quotes, retry safety, cancellation and USD cheque clearing.
- All accounting SQL tests use isolated development fixtures and rollback, including temporary permissions and numbering.
- Build, typecheck, security/permissions, navigation and performance checks precede development deployment. Production is excluded.

Migrations: `20261126030000_tw_accounting_banking.sql`, `20261126040000_tw_accounting_payment_preparation.sql`.
