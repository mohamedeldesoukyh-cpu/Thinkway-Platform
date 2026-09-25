# Collection edits, VAT and creator invoices

- Collection history is under Record client payment. Completed receipts may be revised with an obligatory reason. The revision RPC locks the invoice/payment, checks optimistic revision and remaining balance, and updates payment allocation, invoice totals, campaign billing and deliverable amounts in one transaction. Prior values and reason remain in collection_audit_logs.
- Creator invoices live under Billing / Creator invoices, linked to existing assignments, including paid ones. Received, not received and not provided are explicit states. Attachments are private; PDF/JPEG/PNG up to 4 MB, ten-minute signed reads. VAT includes received, reviewed invoices only. Legacy campaign cost VAT is shown separately as provisional; it is never silently assigned to the current month or deducted again.
- VAT statements separate country, currency and invoice month. Authority payments retain actual payment dates and a selected tax period, reference, method, authority and notes. Monthly balances subtract those records once. Excess payment/negative balances are shown as credit, not negative payable. No FX conversion or cross-period credit allocation is inferred.
- Home has the monthly VAT balance/payable card. Positive balances show Needs to be paid; settled periods show zero payable. This is a records balance, not a statutory filing deadline.
- SQL migrations were applied directly with the project's production/development psql runners (this project has no supabase_migrations.schema_migrations table). Rollback-only integration tests passed on both: payment balance/allocation/audit, stale edits, overpayment, historical creator invoices, confirmation, invalid invoice details, negative payments and unauthenticated writes. No supplier invoice or authority payment test records remain in production.
- TypeScript, nine data/currency regression tests and Collections 23-grid / four-track checks pass.
- New client invoice VAT remains on invoices; adding VAT to a receipt would double count it. Creator VAT can be backfilled by adding the original invoice to the old paid assignment without recording another payment.

## September 25 corrections
- VAT registry displays all invoice statuses across all periods/currencies by default, with explicit exclusions from confirmed balances. Cancelled/superseded/unreviewed invoices remain visible; balances never sum currencies together.
- Creator invoice and VAT routes share Collections masthead, panels, controls, left-aligned numeric formatting, and Back/Billing navigation.
- Payment history offers Creator Inv# / invoice date / tax country and VAT No (0%) or Yes (14%). Save uses the existing campaign-line VAT synchronization, keeps payment history unchanged, rejects pending-export/locked/overpaid/stale changes, and audits invoice revisions.
- Numbered invoices create a single linked confirmed supplier invoice for the original tax month. Missing invoices remain provisional. Full legal details and attachments can be edited separately without changing financial values.
- TypeScript and 19 unit/regression tests passed; Collections grid CI remains 23 blocks / 4 track lists. Both database environments passed rollback integration checks for historical dates, 14% cost totals, unchanged payments, metadata edits and stale/date/auth rejection.

## Invoice lifecycle correction
VAT now uses the shared Billing register eligibility and labels. Active generated invoices retain the legacy database draft value but display Issued and count in VAT. Invoice 2 contributes EGP 123,678.45 for August 2026. Regression checks cover this state, superseded/void/pending exclusions and missing dates. No invoice data was modified.


## Collections save, search and audited deletion (2026-09-25)
- Explicit Save payment and Ctrl/Cmd+S share native form validation; corrections take priority; deletion confirmation blocks save shortcuts. Local mocked UI verified invalid save blocked, one receipt action, edit priority, and explicit deletion confirmation.
- Searchable client selector supports name and canonical/short client code; code selection filters invoices. All six sections have guidance. Load saved draft explains session-only storage. Document references use the existing display formatter; canonical storage is unchanged.
- Development and production rollback tests verify cancellation restores invoice balance, clears allocation, retains original receipt and audit, and rejects duplicate/unauthorized requests. No real receipt was saved or deleted.
- TypeScript and Collections grid CI passed (23 blocks, four track lists).

## Settled invoice visibility and receipt recovery
- Unsettled is the default receipt invoice filter; Show all invoices includes settled records with zero open balance. Saving against a settled invoice remains blocked.
- Payment-row actions are labelled icon buttons. Delete and Restore open modal dialogs requiring a note; keyboard save cannot trigger either or submit the background receipt. Preview verified default filter, settled selection, delete note, cancellation and restore dispatch using mocks.
- Restore RPC preserves original receipt identity, restores allocation and recalculates balances with revision/permission/overpayment guards. Development and production rollback checks cover delete/restore cycles, audit retention, duplicate and unauthorized requests, and an invoice paid by another receipt after deletion.

## Client advances and inline payment editing
- Receipts can be recorded before invoicing with a mandatory client and optional campaign. Campaign advances auto-apply to active issued invoices in matching client/currency; unlinked receipts require explicit Settle. Partial allocation preserves cash by splitting Actual and remaining Advance, with original date/reference and audit linkage retained.
- History includes classification and campaign, sorts by paid_at descending with created_at/id tie breakers, and edits date/amount/method/reference/notes directly in the same row. Correction reason and Ctrl+S use associated native form validation.
- Mocked browser verified inline editing, Ctrl+S, classification filter, advance entry and settlement dialog. Rollback tests cover auto issue and pending-to-active lifecycle, partial/full settlement, no duplicate cash, cross-client/currency/overpayment/stale/auth rejection, idempotent advance creation, and editing/deleting/restoring advances.
