# Stage 8 — Transaction workflows

Four transaction views reuse the existing journal engine and editor: Account transfers, Opening balance workflow, Recurring JV and Scheduled reversing JV. Existing journals remain visible in General JV. No accounting permissions, approval defaults or source posting rules are relaxed.

## Transfers and opening balances

Transfers save a balanced draft with exactly two distinct GL/auxiliary destinations in one currency. Debit the destination and credit the source. Shared auxiliary identities remain unchanged. This creates a new voucher; transaction reclassification continues to move existing lines separately.

Opening journals use active detail balance-sheet accounts on the first day of a configured fiscal year. The editor filters out revenue and expense accounts, and the database independently enforces both date and account type. Multiple balanced opening batches are allowed. This is a GL opening workflow, not an outstanding-invoice importer: client/vendor control balances must retain source invoice and allocation records. No synthetic invoices are created.

Both workflows save drafts, use current system exchange rates and follow optional independent approval, period locks, journal locks, numbering and double-entry controls. Workflow classification is preserved when reopening through General JV. Posting revalidates the workflow even if an older client saved the draft.

## Recurrence and reversal schedules

Create a schedule from an eligible saved manual General/Expenses journal. Recurring schedules capture an immutable line template, including auxiliary identity and foreign amounts. Generation resolves rates at the due date and calls the existing balanced-draft engine. An inactive account, missing rate, closed period or resulting imbalance fails atomically; the occurrence remains due. Source journal edits do not change an existing template. Pause the old schedule and create a new one when a template needs revision.

Schedules support monthly intervals from 1–12 months and an optional end date. Dates are always calculated from the original anchor: 31 January → 28 February → 31 March, without month-end drift. The authorized accountant generates one due occurrence at a time. Generated drafts require normal review/posting and approvals when enabled. No unattended background posting is introduced.

Scheduled reversals accept only original posted manual journals, excluding automatic invoice/receipt/payment journals. Explicit execution posts through the existing reversal function, preserving original amounts/rates and honoring locks and periods. A completed reversal cannot be resumed. Source-specific corrections remain in their original workflows.

A unique schedule/date run record and company serialization prevent duplicate generation on retries. Cancelling a generated draft does not regenerate it. The screen shows recent generated journal IDs and dates for traceability. Schedule creation, changes and runs use the existing accounting audit table; two new operational tables store schedules and occurrence identities, not duplicate ledger balances.

## Validation

`scripts/test-tw-accounting-workflows.sql` runs rollback-only development fixtures: recurring generation, month-end anchoring, duplicate retries, paused schedules, scheduled reversal, transfer destinations, opening dates/account types, generated-draft approval, USD/EGP revaluation at the due date, atomic closed-period failure, read-only denial and MFA. The existing ten accounting SQL regressions also run after the migration. Application CI includes build, types, security/workspace boundaries, unit tests and unchanged performance budgets.

Migration: `20261126020000_tw_accounting_workflows.sql`. Development release only; no production migration or test records.
