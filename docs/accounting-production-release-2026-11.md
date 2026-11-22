# Accounting Production release preparation — 22 November 2026

Production is unchanged. This corrected candidate requires explicit approval after Dev verification; do not run Production migrations as part of verification.

## CSS correction

The integrated baseline was 1,567.6 KiB. New Production theme/responsive rules and preview-layout styling account for the increase over the earlier Dev-only candidate. Those live fixes remain included.

The correction removes retired selectors, unreferenced animations and declarations overridden by later rules with the same selector/conditions. Equivalent equal-specificity selector groups use `:is()` to avoid repeating ancestors. Required declarations, theme tokens, responsive behavior and the frozen Discovery foundation remain present. No budget or baseline is changed. An attempted Discovery import consolidation was rejected because it duplicated the foundation for other routes; the original import structure is retained.

Local production build: 1,545.1 KiB CSS (22.5 KiB reduction, 4.9 KiB headroom). Hosted CI is authoritative. This is deliberately limited cleanup; CSS capacity remains tight and future changes must pass the existing gate.

Chrome computed-style comparison: 486 constructed cases from changed styles, at 390, 768 and 1440px, both light and dark. No differences across the 50 checked properties and normal/before/after styles. Motion was disabled to make comparisons deterministic; retired animation references are checked separately. These fixtures supplement, rather than replace, live Dev UI review. Evidence is in `.tmp/css-browser/results.json`.

`check-release-css.cjs` protects retired classes against reuse, including a rendering graph scoped to the Client Workspace for its private sheet, and checks that removed animations remain unreferenced. Existing Discovery cascade/motion guards remain active.

## Dependency security

The registry reported moderate Next.js advisories affecting 16.4.4. Next.js and its matching ESLint configuration are patched to 16.4.6. The lockfile changes only that patch family. This is a security patch, not a framework migration or performance refactor. Existing ExcelJS/uuid advisories require separate assessment; no forced major downgrade is included.

## Fresh Production installation audit

Production has no `tw_*` Accounting tables. All 26 Accounting migrations are required, in filename order, beginning with `20261121180000_tw_accounting_setup.sql` and ending with `20261126070000_tw_accounting_fiscal_close.sql`. The ordered SHA-256 manifest is saved in `.tmp/accounting-release-migration-manifest.json`. None of those migration bodies changed in this correction.

Read-only catalog comparison: all 2,871 pre-existing Dev application columns match Production by name, PostgreSQL type, nullability and default. The only extra Production table is `assignment_live_state_backup_20261110`; preserve it. The two directory functions absent in Production (`search_worked_vendors`, `worked_vendor_total_count`) are created by the Accounting migration series.

Dependencies proceed through setup/module boundaries → journals/posting locks → invoices/FX → receipts/allocations → auxiliaries and party accounts → system mappings/shared parties → transaction controls/workflows → banking/payment preparation → reports/budgets → fiscal closing. Referenced Media identities and financial tables already exist. Production schemas, data, users and document counters are not copied from Dev.

Fresh-install rehearsal passed in a separate, transaction-local Dev schema using empty structural clones of the existing tables/views, with only Dev authorization fixtures. The rehearsal preserves column/check/index definitions and RLS flags. It changes schema qualifiers to isolate the installation; it is not a literal Production execution and does not replace the catalog comparison. All 26 migrations created 32 Accounting/module tables, and an isolated company/calendar initialized successfully. The transaction rolled back and the schema was confirmed absent afterwards. Existing Media policies and runtime workflows are separately exercised by the normal rollback regression suites.

Read-only Dev security audit found no Accounting table without RLS, no non-trigger Accounting function executable by `anon`, and no security-definer Accounting function without an explicit search path. Migration definitions include required primary/unique/foreign-key constraints and indexes. Existing invoice guards are deliberately extended for the authorized unpost/correction workflow; they are the two pre-existing functions that require saved definitions for recovery. New shared-party triggers do not require importing Dev directories.

## Approved-release execution and recovery procedure

1. Confirm corrected Dev SHA, mandatory CI and browser/SQL verification. Obtain explicit approval for this corrected Production release.
2. Refresh read-only Production baseline: deployment identity, affected function definitions, policies/triggers, account/configuration/permission and business-data counts/hashes. Existing snapshots are `.tmp/production-preflight-before.txt` and `.tmp/production-business-before.txt`; refresh them immediately before release because legitimate business activity can occur.
3. Assert this is still a fresh installation. If Accounting tables now exist, stop and reassess; do not replay the fresh-install batch.
4. Execute only the reviewed 26 migrations in one transaction, removing their individual transaction wrappers in the release batch. Use `ON_ERROR_STOP`, a 5-second lock timeout and a 120-second statement timeout. Record the exact applied versions in the migration ledger in that same transaction. Do not push all pending unrelated migrations.
5. Any failure before commit rolls the entire installation back. Verify no Accounting tables/version entries remain. Never bypass a dependency error or timeout.
6. Deploy only the approved `develop` → `main` PR result using the established Vercel release process. Keep Production transaction verification read-only; do not allocate business numbers, create QA records or close 2026.
7. If the application regresses after commit, promote the previous known-good deployment (`dpl_43TGCK6BAdRkUZiZAMirvGkkaVzr` at preparation time; refresh before release), verify build identity and readiness, and stop release progression.
8. Do not run destructive schema down-migrations. Keep the additive schema and any legitimate new records. Assess a narrowly scoped forward repair or restoration of the two saved invoice-guard definitions, with affected data preserved and reviewed. Do not remove fiscal history or reset sequences.

No Production company/calendar is initialized by the migration batch. Real Thinkway configuration must use approved business settings and Production third-party identities when separately executed as part of the approved installation; never copy Dev fixture rows to obtain an account count.
