# Stage 6 — Accounting navigation and audited module inventory

This is the Stage 6 baseline inventory. [Stage 7 transaction controls](tw-accounting-stage7.md) implements optional journal approvals, individual/bulk locks and scoped control history from the pending list below.

## Scope and architecture

Navigation restructuring only. Cost centers are excluded by user instruction. No database migration, accounting calculation, API, posting rule, record, serial, or authorization change is required. Future budgets use GL accounts and fiscal periods.

Before: 15 flat sidebar shortcuts plus 18 duplicate setup tabs; company, fiscal years and user access were only in the tabs. The sidebar disappeared on smaller screens. Breadcrumbs always said General ledger.

After: one central registry (`features/accounting/navigation.ts`) drives ten ordered groups, bilingual labels, active items, parent expansion and role-based visibility. Nineteen entries preserve all 18 existing views and add a vendor preset to the existing Third Party desk. Clients and vendors use existing Media identities; no new directory or table is introduced. The existing `/accounting` route and bookmarks remain valid. Navigation uses the existing in-page view state and dirty-journal guard; it does not introduce new routes or browser-history semantics.

English/Arabic selection translates navigation and breadcrumbs and places Arabic navigation on the right. Existing transaction forms retain their English/LTR layout and numeric formatting. Native buttons provide keyboard activation; parents expose expanded state, current screens expose `aria-current`, and the mobile menu can be dismissed with Escape. Empty future groups have noninteractive Planned labels, never dead links.

## Operational inventory

All ready destinations below use `/accounting` with the indicated existing view. They require Accounting access; modifications retain Accounting management, MFA, row-level security and RPC checks. Module access configuration additionally requires administrator access. Source components and operational evidence are recorded per item in the registry. Registry array order is the display order; `parent` identifies the group, `navigation` is visibility intent and `permission` is the menu visibility requirement (not a replacement for backend authorization).

| Group | Ready screen / view | Existing implementation and dependencies |
|---|---|---|
| Transactions | General JV / `journals` | JournalDesk; balanced draft/save/post, manual reversal, FC/LC, preview; company, GL, rates, open periods |
| Transactions | Expenses JV / `expenses` | Existing JournalDesk expenses mode and account restrictions |
| Transactions | Platform invoice posting / `invoices` | InvoiceDesk; Media invoices and mapping; post/unpost/repost keeps journal identity; invoice creation stays in Media |
| Transactions | Cost invoices / `costs` | CostInvoiceDesk; internal provisional cost invoices and supplier invoice handling |
| Transactions | Transaction reclassification / `moves` | AccountMoves; selected/all historical transaction reassignment, compatibility checks and audit trail; not a new transfer JV |
| Receipts | Receipts & advance allocation / `receipts` | SettlementDesk receipt mode; invoices, advances, allocation, FX, Media synchronization, reversal, receipt/JV print |
| Payments | Payments & advance allocation / `payments` | SettlementDesk payment mode; vendor payables, advances, allocation and reversal |
| Third Parties | Clients / `parties` | Existing PartyAccountsDesk client preset; shared codes, create/sync, multiple compatible GL accounts |
| Third Parties | Vendors / creators / `vendors` | Same PartyAccountsDesk vendor preset; existing vendors used in assignments; no duplicate data |
| General Ledger | Chart of accounts / `chart` | Saved chart, grouping, account setup, own/shared/no auxiliary and Third Party links |
| General Ledger | Auxiliaries & sharing / `auxiliaries` | AuxiliaryDesk; source account setup remains accessible here; shared UUIDs, independent GL balances |
| General Ledger | Fiscal years / `years` | Existing financial-year setup and monthly period generation |
| General Ledger | Accounting periods & locks / `periods` | Existing period lock/unlock; journal permission and open-period checks retained |
| Reports | General ledger / `ledger` | Posted GL entries, existing JournalDesk filters/export |
| Reports | Trial balance / `trial` | Existing posted debit/credit balances |
| Reports | Account, auxiliary & Third Party statements / `statements` | Existing StatementDesk modes: GL, shared auxiliary, client/vendor, unsettled; per-GL and consolidated balances, opening balances and CSV |
| Administration | Module access rights / `users` | Existing admin-only assignment editor; no privilege expansion |
| Settings | Company & base currency / `company` | Existing company and enabled-currency configuration |
| Settings | Media posting mappings / `mapping` | Existing revenue/cost/AF/UR/revenue-share/FX/VAT/AR/AP/advance mappings; reserved future mappings do not imply implemented automation |

Shared auxiliary configuration, subledger statements, receipt adjustments and advance allocations remain inside their working hosts instead of duplicating their screens. Reports share filters rather than adding duplicate client/vendor/auxiliary report implementations.

## Pending and partial registry

Pending entries have no active menu destination. Their labels, classification and implementation evidence are centralized alongside ready entries.

| Group | Pending functionality | Dependencies / distinction |
|---|---|---|
| Transactions | Recurring JV; scheduled reversing JV | Scheduling absent. Manual journal reversal already works inside General JV. |
| Transactions | Opening balance workflow; account transfers | Manual balanced JV exists; no dedicated opening/import or transfer workflow. Reclassification edits transaction classification and is separate. |
| Transactions | Journal approvals; individual/bulk transaction lock/unlock | Posting permissions, posted immutability, invoice unpost and period locks do not constitute an approval matrix or individual lock registry/history. |
| Payments | Payment preparation; cheque payments | Batch preparation, cheque lifecycle and clearing not implemented. |
| Banking | Bank account management; reconciliation; cash/bank movements screen | Bank GL accounts and auxiliaries already exist; dedicated bank master, imports/matching and banking screen absent. Movements remain available in General ledger. |
| Budgets | Setup/allocation; controls/variance | Requires GL/fiscal-period budget model. Media assignment budgets are not accounting budgets. |
| Reports | GL P&L, balance sheet, cash flow; client/vendor aging; budget reports | Posted ledger exists; dedicated financial statements, aging buckets and accounting budgets absent. Media operational P&L is not a GL financial statement. |
| General Ledger | Fiscal year closing | Reserved system accounts do not constitute an operational closing workflow. |
| Administration — Partial | Audit logs/activity viewer | Database audit trails exist; dedicated Accounting viewer absent. |
| Administration — Partial/shared | Users, roles, permissions, access control | Existing Media-owned `/settings/users`, `/settings/roles`, `/settings/permissions`, `/settings/access-control`; retained under existing module switch and route permissions. No duplicate administration UI or Accounting-only grant to Media routes. |
| Settings — Partial/shared | Currencies & exchange rates | Existing `/finance/exchange-rates` and shared rate records/resolution; retained in Media. Accounting currency setup is ready; dedicated cross-module access has not been added. |

## Verification and release

- Registry tests cover every legacy view, ordering groups, unique identities, Arabic labels, pending-link exclusion, administrator visibility and lock/transfer distinctions.
- Existing accounting model tests cover balanced journals, invoice FX, receipt FX, allocation, shared auxiliary and Third Party consolidation.
- Database regression runs use the development-only runner and rolled-back fixtures; no production tests or serial allocations.
- Typecheck, targeted lint, inherited-client-boundary validation and production build are required before release. CI includes the new navigation regression tests.
- Dev browser review must cover expanded groups, active breadcrumbs, client/vendor presets, Arabic RTL and mobile navigation. Existing backend guards remain unchanged; menu visibility is not treated as authorization.
- Target: https://dev.thinkwaymedia.com/accounting. No live deployment is authorized in this stage.

## Following stages

Continue business functionality only after review of this navigation stage: transaction workflows/controls, banking, GL financial statements and aging, then GL/fiscal-period budgets and closing. Each stage begins with the audited pending inventory and preserves the existing shared parties, auxiliaries, mappings, posting and settlement rules. Cost centers are not part of these stages.
