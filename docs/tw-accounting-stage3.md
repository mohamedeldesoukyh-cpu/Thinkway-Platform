# TW Accounting Stage 3 — manual journals and ledger

Available in the Accounting module: journal drafts, explicit review/post, draft
cancellation, linked posted reversals, general ledger, trial balance and monthly
period locks. Company scope and read/manage module assignments are retained.

All journal amounts use the company base currency (Thinkway: EGP). Manual journals
accept active Posting accounts. Summary, System and Control accounts are excluded;
customer/supplier subledger entries will come through the later billing and
collection integration. There is no automatic depreciation calculation, opening
balance import, FX conversion, invoice synchronization or year-end close in this stage.

## Posting rules

- Drafts can be unbalanced, but need at least two valid lines and an open period.
- Each line has exactly one positive debit or credit, at most two decimal places.
- Posting validates the current draft version, accounts, period and equal totals.
- A company/fiscal-year counter allocates `JV-2026-000001` only inside a successful
  posting transaction. Repeated posting/reversal requests return the same document.
- Posted documents are read-only. Reversals swap the original lines into a new
  posted voucher on a chosen open-period date, on or after the original date.
- Cancelled drafts are retained and never affect balances or allocate numbers.
- Read access does not permit mutations. Management mutations require AAL2 MFA.
- Period closing requires a reason; only administrators may reopen a period.
- Company locks serialize posting, reversal, period changes and account structure
  changes. Accounts with posted activity cannot change type, kind, side or parent.

The database grants no direct journal/line/counter write access to anonymous,
authenticated or service roles. Validated SECURITY DEFINER functions are the only
application write path. Header/line changes, draft replacement and period changes
are audited. Accounting managers can both prepare and post; a separate approver
workflow is not configured in this stage.

## Reports

Ledger and trial balance include posted entries only, including both original
entries and their reversals on their respective dates. Opening is all posted
activity before the start date; closing includes activity through the end date.
Signed amounts use debit positive / credit negative. Trial-balance closing amounts
are split into debit and credit columns, without counting group accounts twice.

Journal lists use 50-row pages. Ledger entries use 100-row pages; opening, closing
and period totals always cover the full requested range. Ledger CSV explicitly
exports the current page. Trial-balance CSV exports the filtered account list.
PostgreSQL numeric and client integer-cent arithmetic prevent floating-point drift.

## Development validation

Run `tsx --test features/accounting/journal-model.test.ts` and the existing
accounting/auth route tests. Use the development-only psql runner for
`scripts/test-tw-accounting-journals.sql`; all fixture journals and document counters
roll back. It covers permissions/MFA, stale drafts, balance/precision validation,
number retries, locks, immutable posting, inactive/control accounts, reversals,
trial balance and running balances across a 100-row page boundary.

The pre-production legacy Media RPC/service-role isolation audit noted in Stage 2
remains outstanding. This stage changes only Accounting RPCs and does not install
the previously rejected global PostgREST hook.
