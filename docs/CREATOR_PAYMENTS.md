# Manual creator payments

Campaign Finance, Creator CRM → Payments, and Billing → Vendor payments share the same creator-payment ledger. A current generated creator IO makes its assignment visible; IO approval is displayed separately and the campaign lifecycle is unchanged.

## User flow

1. Save AAIB beneficiary details in CRM → Payments. Select creators on the CRM list and export **AAIBeConnect - Beneficiary_Registration_Template.xlsx**. The original reference sheets and 15-column layout are retained.
2. Register the beneficiaries in AAIB and confirm registration in CRM. Changes to bank identity or routing details clear that confirmation.
3. Open Campaign → Finance → Creator Payments. Review agreed fee, VAT, total fees, paid and outstanding in the original currency. Fee/VAT adjustments apply to the payment basis; they do not rewrite issued IOs.
4. Select creators. Choose a percentage of VAT-inclusive total, the full available balance, or a manual amount. Choose payment currency and enter the exchange rate when different. Converted amounts show their original equivalents.
5. Review and export **BulkPayment_With_Advice.csv**. Choose the company debit account, transfer date, bank charge allocation and purpose code. Optional advice requires the actual invoice reference, date, amount and beneficiary email. Use English payment details/references for the supplied bank file encoding.
6. Upload to AAIB. Export reserves the balance; it does not record a payment. After checking bank results, confirm each successful transfer with its reference, or mark a rejected/cancelled transfer with its reason. A failed transfer releases its reservation.

Successful confirmations update unpaid (red), partially paid (orange), and fully paid (green) automatically. Batch history downloads the same file and references, avoiding a newly generated duplicate. Payment currency must match the registered beneficiary currency.

## Deployment and verification

Apply `supabase/migrations/20260921130000_creator_payment_exports.sql` transactionally before deploying the app. It creates payment terms, export batches, entries, a balances view, scoped permissions and consistency triggers. Existing campaign stages and IO approval rules are untouched.

- TypeScript: `npx tsc --noEmit --incremental false`
- Unit/template tests: `node --import tsx --test features/creator-payments/payments.test.ts`
- Development integration tests: `node scripts/psql-development.mjs -f scripts/test-creator-payments.sql` (all test writes roll back)

Exports are validated against the supplied templates, including column counts, leading-zero accounts, date limits, purpose codes, references and CSV header encoding. Actual bank acceptance, beneficiary identity, and the entered FX rate require the operator's bank verification. No banking API or automatic money transfer is used.

Confirmed entries retain original fee, VAT, FX, total and payment amounts. Finance permissions are enforced in server actions and database functions; direct authenticated writes to ledger tables are disabled. Original currencies with active ledger entries cannot be changed through the legacy assignment form, and legacy full-payment recording cannot overwrite ledger balances.
