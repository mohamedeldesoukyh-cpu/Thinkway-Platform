# Stage 11: monthly GL budgets

Budgets use the existing company, fiscal periods and income/expense accounts. Annual allocation preserves every cent across twelve months; users can edit individual months. Entries retain optimistic versions and existing accounting audit records. Closed months cannot be changed, but unchanged closed-month values do not prevent revision of open months. No cost centers or duplicated Media campaign budgets.

Actuals use posted GL entries in company base currency. Revenue and expense variances use their correct favorable/unfavorable signs. Unbudgeted actuals remain visible. Controls are advisory; no new posting approval or block is introduced. CSV exports use saved values and formula-safe escaping.

Validation: typecheck, targeted lint, allocation/variance/navigation tests, and rollback-only development SQL tests for actuals, stale versions, closed periods, atomic failure and MFA. Dev browser verification follows the passing build/security/performance gate.
