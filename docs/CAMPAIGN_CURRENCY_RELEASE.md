# Campaign currency consistency

The campaign header currency is the reporting currency and the currency of newly
created client invoices. Assignment inputs remain in their original currencies.
Read-only campaign money cells show the converted amount first and the original
amount beneath it. Mixed-currency totals retain separate original references.

## Financial boundaries

- Operational billing is normalized and linked in original assignment units,
  then projected for display. Submission restores native amounts before applying
  the existing partial-invoice allocations.
- Invoice line creation converts the allocated source amount before the existing
  VAT/total trigger runs. `metadata.billing_fx` records original amount, currency,
  converted currency and the rate history. Appending converts only the new slice;
  existing billed amounts remain frozen. Authorized regeneration rebuilds the
  snapshot through the existing lifecycle.
- The RLS-preserving `invoice_line_items_operational` view supplies native
  coverage to locking, repair and collections. Reporting still uses invoice
  currency; operational remaining balances use native coverage at current FX.
- The selector validates FX, saves the currency and updates persisted PO guards
  in one database transaction. Refreshing the workspace also reloads deferred
  tab data. Existing issued documents are not rewritten by currency/rate changes.
- Approval, Vendor IO eligibility, VAT, partial billing and lifecycle gates remain
  authoritative. Legacy invoice-header coverage and query fallbacks are retained.

## Validation

- `npm run test:fx`: conversion and server-rendered money references, all supported
  currency pairs, repeat switching, missing rates, mixed costs and native partial
  allocations.
- Billing regression suite: partial invoicing, coverage, locks, regeneration,
  queue eligibility and repair.
- Campaign lifecycle regression, service-layer and Vendor IO terms/parity suites.
- `scripts/test-campaign-billing-currency.sql`: development transaction rolled
  back after testing all 36 currency pairs, VAT and exemption, selector/PO
  synchronization, frozen document values, append after FX changes and regeneration.
- Existing FX revaluation database regression passes unchanged.
- Typecheck and production-mode Next.js build.

Authenticated browser verification was not performed. Automatic approval review
rejected a temporary privileged test-account setup; no account was created.
Database tests and server-rendering checks cover the authorized alternatives.

## Deployment and rollback

Apply `20260920160000_campaign_billing_currency.sql` before deploying the code.
The migration only adds/replaces functions, a trigger and a read view; it does not
rewrite existing financial documents. The production audit found no existing
non-void invoice lines whose assignment and invoice currencies differed.

Do not remove native-coverage support after converted invoices have been created.
A rollback must retain the view and coverage readers, or first reconcile those
invoice snapshots. Turning off the new display alone does not require changing
stored amounts or approval records.
