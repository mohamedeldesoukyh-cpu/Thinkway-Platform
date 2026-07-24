# P0 Deployment Notes — Finance Control & FX RLS

**Audit refs:** `docs/security/authentication-audit.md` P0-01, P0-02  
**Date:** 24 Jul 2026  
**Scope:** Least-privilege RLS for finance control tables + exchange rates; FX server-action gates. No P1/P2/P3 work.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Migration | `supabase/migrations/20260724150000_finance_fx_rls_least_privilege.sql` |
| FX actions | `features/finance/exchange-rates/actions.ts` |
| FX resolve action | `features/finance/exchange-rates/resolve-rate-action.ts` |
| Seed grants (fresh DBs) | `supabase/seed.sql` |
| SQL regression tests | `supabase/tests/rls/finance_fx_p0_regression.sql` |

---

## What changed

### Database

1. Added permissions: `finance.read`, `finance.write` (and ensured `finance.override`).
2. Granted `finance.read` / `finance.write` / `finance.override` to `super_admin`, `admin`, `finance`.
3. Helpers: `can_read_finance_control`, `can_write_finance_control`, `can_access_finance_client`, `can_write_finance_client`, `can_access_finance_campaign`, `can_write_finance_campaign`, `can_write_exchange_rates`.
4. Dropped all finance-control `USING (true)` / `WITH CHECK (true)` policies.
5. New policies require finance permission slugs + `is_internal_user()` (portal/`client_user`/`influencer` denied) + client/campaign scoping via `can_access_client` / `can_access_campaign_header`.
6. `FORCE ROW LEVEL SECURITY` on finance control tables and `md_exchange_rates` / `fx_rate_audit_logs`.
7. `md_exchange_rates`: SELECT → `is_internal_user()`; INSERT/UPDATE/DELETE → `finance.override` (or admin).
8. `md_currencies` INSERT/UPDATE gated by `can_write_exchange_rates()` (SELECT policy unchanged).

### Application

- `upsertCurrencyAction` / `upsertExchangeRateAction` call `requireFinanceOverrideAccess()` (admin/finance/`finance.override`).
- `resolveExchangeRateAction` requires auth + internal role (portal rejected).

PO actions in the same file were left unchanged (outside P0 FX write scope).

---

## Deploy steps

### Local

```bash
supabase db reset
# or apply forward only:
supabase migration up

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/finance_fx_p0_regression.sql
```

Expect `NOTICE: PASS: ...` and `P0 finance/FX RLS regression suite completed successfully.`

### Staging / production

1. Take a short maintenance window if finance users are actively posting CN/DN (policies swap is brief).
2. Apply migration only (do **not** re-run old migrations):

   ```bash
   supabase db push
   # or your CI: supabase migration up --linked
   ```

3. Confirm migration applied:

   ```sql
   SELECT version, name
   FROM supabase_migrations.schema_migrations
   WHERE version = '20260724150000';

   SELECT slug FROM public.permissions
   WHERE slug IN ('finance.read', 'finance.write', 'finance.override');

   SELECT c.relname, c.relforcerowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'finance_documents', 'finance_posting_batches', 'erp_sync_queue',
       'finance_document_links', 'client_credit_notes', 'vendor_credit_notes',
       'client_debit_notes', 'vendor_debit_notes', 'md_exchange_rates'
     );
   ```

4. Smoke-test as:

   | Persona | Expect |
   |---------|--------|
   | Finance | Can open posting center / adjustments; can save FX rates |
   | Admin | Full access retained |
   | Viewer | No finance control rows; cannot mutate FX |
   | Client portal | No finance control / FX rate rows |
   | Ops without `finance.override`* | Can read rates if internal; cannot write rates |

   \* Production `operations` currently retains `finance.override` from older migrations; RLS allows ops FX writes until that grant is narrowed (out of P0). App layer also allows finance role via `requireFinanceOverrideAccess`.

5. Deploy app build containing the FX action permission checks **with or immediately after** the migration (app checks alone are insufficient without RLS; RLS alone is sufficient for data plane).

---

## Rollback

```sql
-- Prefer forward-fix. Emergency only: restore permissive policies is NOT recommended.
-- Instead: fix grants / helper functions in a new migration.
```

If the migration must be reverted before a fix:

1. Do **not** edit `20260724150000_*.sql`.
2. Ship a new migration that reintroduces temporary policies only if business-critical, then harden again.

---

## Post-deploy verification checklist

- [ ] Migration `20260724150000` present on target
- [ ] No `USING (true)` / `WITH CHECK (true)` policies on finance control + `md_exchange_rates`
- [ ] Regression SQL passes
- [ ] Finance UI posting / CN-DN paths work for finance users
- [ ] FX workspace save works for finance/admin
- [ ] Client portal user cannot query `finance_documents` or `md_exchange_rates` via API

---

## Out of scope (intentionally)

P1–P3 items from `authentication-audit.md` (invite hashing, `/api/ready`, auth callback redirect, MFA, quotation export, etc.).
