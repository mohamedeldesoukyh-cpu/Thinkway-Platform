# TW Accounting Stage 2

Stage 2 persists company books, chart accounts, currencies and financial calendars.
The confirmed development company is Thinkway, Egypt (EG), EGP, 1 January–31 December 2026.
Each new company receives the 102-account starter chart and twelve monthly periods.

Account codes and company base currency/fiscal start month are immutable. Accounts
can be edited or deactivated; groups with children cannot be deactivated. Changes
are audited, and UI updates use version checks to reject stale edits. Financial
years are created atomically through a validated RPC; direct period inserts are denied.

Administrators can assign Media, Accounting read, or Accounting manage to internal
staff. Administrators retain both modules; portal users are excluded. Defaults keep
existing staff Media access and give finance roles Accounting management access.
Accounting access covers all configured companies. Management writes require AAL2.

One assigned module opens directly after login; two modules show the chooser. The
server guards routes and common permission checks. Restrictive RLS supplements
existing policies on Media tables. Accounting-only staff cannot read those tables
directly. **Before production, separately audit legacy SECURITY DEFINER Media RPCs
and service-role actions for the new module boundary.** Table RLS alone does not
guard those paths. A proposed global PostgREST hook was rejected by automatic
approval review and was not installed; no global authenticator configuration changed.

Development migrations:
- `20261121180000_tw_accounting_setup.sql`
- `20261121183000_tw_accounting_directory_boundary.sql`

Tests: `tsx --test features/accounting/chart.test.ts features/accounting/setup.test.ts`.
Database integration: use the development-only psql runner with
`scripts/test-tw-accounting-setup.sql`; all fixtures and assignment changes roll back.

Journal entry, posting, ledger balances, closing, foreign-currency rates and
Media invoice/collection synchronization are subsequent stages, not active features.

Dev browser verification passed: company creation, account creation, Arabic name persistence, account editing/deactivation followed by reload, fiscal calendar and dual-module chooser. The isolated browser test company was removed; only Thinkway remains. Portal role users are also excluded without a membership link, covered by rollback SQL tests.
