# Accounting delivery roadmap

User authorization: implement sequentially, test and resolve blockers, deploy each stage to development before starting the next. Make routine design decisions autonomously. Production deployment is excluded. Cost centers are excluded. Direct posting remains the default; approvals are optional per company.

| Stage | Scope | Status |
| --- | --- | --- |
| 1–6 | Foundation, posting, settlement, auxiliaries, Third Parties, mappings and navigation | Delivered on dev |
| 7 | Optional independent journal approval, transaction locks, control history | Delivered and browser verified; PRs 38/39, develop `1a0100f8` |
| 8 | Transfers, opening balances, recurring journals and scheduled reversals | Delivered and browser verified; PRs 40/41, develop `199665a5` |
| 9 | Bank accounts, movements, reconciliation and payment preparation | Delivered on dev; matching/closing browser verified and fixtures removed; CSV chooser verification incomplete |
| 10 | Financial statements and Third Party aging | Delivered and browser verified; PRs 43/44, develop c2766138 |
| 11 | Budgets, allocation and variance | Implemented; dev validation in progress |
| 12 | Fiscal closing and final regression/review | Pending |

Stage 7: build, typecheck, unit/security/performance checks and ten development SQL regression scripts passed. Browser checks covered submission, self-approval prevention, batch lock/unlock, locked editor, history and mobile layout. The isolated dev company and both unnumbered drafts were removed. Thinkway retains approval policy off. No production data or business document numbers were used for testing.

Implementation decisions for the remaining stages must reuse the journal engine, existing audit records and module permissions. Recurring entries generate reviewable drafts; scheduled reversals require explicit execution by an authorized accountant. No unreviewed background posting is introduced. New features must not disguise missing source invoices, invent Third Party balances, duplicate shared identities or relax the performance budgets.
