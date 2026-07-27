# Creator Intelligence RLS Assessment

**Date:** 26 July 2026  
**Mode:** Read-only (no migrations, no policy changes, no deploys)  
**Related:** SEC-003 · Finance pattern `20260724150000_finance_fx_rls_least_privilege.sql`  
**Sources:** `supabase/migrations/*` (winning policy state); app usage scan

---

## Executive verdict

Creator Intelligence **core tables have RLS enabled but never FORCE’d**, and **every SELECT policy is `TO authenticated USING (true)`**. Any JWT with Postgres role `authenticated` — including **client and creator portal** sessions — can read proprietary DNA, IPL raw snapshots, projections, enrichment runs, and forecast baselines via **PostgREST / Supabase SDK**, regardless of app UI gates.

This is the pre-hardening pattern Finance already left behind (`is_internal_user()` + permission helpers + `FORCE ROW LEVEL SECURITY`).

| Domain | SELECT gate | Portal denied? | FORCE RLS |
|--------|-------------|----------------|-----------|
| Finance control / FX (post-P0) | `is_internal_user()` + `finance.*` | Yes | Yes |
| `intelligence.*` warehouse | `can_read_intelligence()` | Yes | **No** |
| Creator Intelligence core (`creator_dna*`, `ipl_*`, …) | `USING (true)` | **No** | **No** |
| Campaign Intelligence Profiles | owner / `can_access_*` | Effectively yes* | **No** |

\*CIP SELECT is scoped; portal users lack campaign-intelligence access helpers unless they are `created_by` of a row.

---

## Scope map (what exists vs named in request)

| Requested name | Actual object(s) |
|----------------|------------------|
| `creator_dna` | `public.creator_dna` |
| `creator_dna_versions` | `public.creator_dna_versions` (+ staging, lineage) |
| `creator_intelligence` | `public.creator_intelligence` |
| `creator_intelligence_snapshots` | **Does not exist** — closest: `public.ipl_snapshots` |
| `ipl_*` | `ipl_refresh_policies`, `ipl_provider_runs`, `ipl_snapshots`, `ipl_reprocess_jobs` |
| `forecast_*` (CI) | `influencer_metrics_history`, `creator_content_performance_baselines` (not finance `forecast_versions` / `forecast_lines`) |
| `enrichment_*` | `public.creator_enrichment_runs` |
| Related proprietary | `intelligence.*` (10 tables), `campaign_intelligence_profiles` / `_documents` |

---

## Complete inventory — Creator Intelligence core

Legend for **Effective exposure**: assumes table `GRANT SELECT` to `authenticated` (present for DNA/IPL/CI/forecast tables; enrichment grants may be incomplete — see notes).

### 1. `creator_dna`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `creator_dna_read` → `authenticated` → `USING (true)` |
| INSERT | `creator_dna_insert` → `discovery.write` \| `discovery.admin` \| influencer `created_by` |
| UPDATE | `creator_dna_update` → same as INSERT |
| DELETE | **None** (GRANT DELETE exists but RLS denies) |
| Roles with access | **Read:** all `authenticated`. **Write:** permission/owner. **Bypass:** `service_role` |
| Effective exposure | **High** — full DNA + Apify-derived fields readable by portal JWTs via REST |
| Recommended policy | SELECT/INSERT/UPDATE: `is_internal_user()` AND (`discovery.read`/`discovery.write`/`discovery.admin` or owner). FORCE RLS. No DELETE for authenticated (admin/service only). |

### 2. `creator_dna_staging`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| INSERT / UPDATE | `discovery.write`/`admin` or discovered_profile / promoted influencer owner |
| DELETE | None |
| Roles with access | Read: all authenticated; write: discovery/owner; service_role bypass |
| Effective exposure | **High** — pre-promotion DNA open |
| Recommended policy | Same as `creator_dna` (internal + discovery.*) |

### 3. `creator_dna_versions`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| INSERT | discovery/owner |
| UPDATE / DELETE | None (append-only) |
| Roles with access | Read: all authenticated |
| Effective exposure | **High** — full version history |
| Recommended policy | SELECT: internal + `discovery.read` (or admin). INSERT: internal + write/owner. FORCE RLS. |

### 4. `creator_dna_lineage_events`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| INSERT | discovery/owner |
| UPDATE / DELETE | None |
| Roles with access | Read: all authenticated |
| Effective exposure | **Medium–High** — lineage/audit |
| Recommended policy | Same as versions |

### 5. `creator_intelligence`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `creator_intelligence_read` → `USING (true)` |
| INSERT / UPDATE / DELETE | **No policies** — authenticated writes denied; grants CRUD to authenticated are ineffective under RLS |
| Roles with access | Read: all authenticated; writes: **service_role only** |
| Effective exposure | **High** — projection (tier, audience, scores) open to portal |
| Recommended policy | SELECT: `is_internal_user()` AND (`discovery.read` OR `intelligence.read`). Writes: service_role only (or internal `discovery.admin`). FORCE RLS. Revoke unused authenticated INSERT/UPDATE/DELETE grants. |

### 6. `ipl_refresh_policies`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| INSERT / UPDATE / DELETE | None |
| Roles with access | Read: all authenticated; write: service_role |
| Effective exposure | **Medium** — TTL/config disclosure |
| Recommended policy | SELECT: internal + `discovery.read`/`discovery.admin`. Mutate: service_role / admin. FORCE RLS. |

### 7. `ipl_provider_runs`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| Writes | None for authenticated |
| Effective exposure | **High** — provider run metadata |
| Recommended policy | Same as refresh_policies |

### 8. `ipl_snapshots` *(stands in for “creator_intelligence_snapshots”)*

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| Writes | None for authenticated |
| Effective exposure | **Critical** — raw + normalized provider payloads |
| Recommended policy | SELECT: internal + (`discovery.read` OR `discovery.admin`). Prefer narrower `discovery.admin` for raw columns if column-level ever needed. FORCE RLS. Writes: service_role only. |

### 9. `ipl_reprocess_jobs`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| Writes | None for authenticated |
| Effective exposure | **Medium** — job queue visibility |
| Recommended policy | SELECT: internal + discovery.read/admin. FORCE RLS. |

### 10. `creator_enrichment_runs`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| Writes | None for authenticated |
| GRANT | **No GRANT in migrations** — exposure depends on live DB privileges |
| Effective exposure | **High if SELECT granted**; policy already permissive |
| Recommended policy | Explicit GRANT SELECT to authenticated only after hardening; SELECT: internal + discovery.read. FORCE RLS. Writes: service_role. |

### 11. `influencer_metrics_history`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| Writes | service_role grants only |
| Effective exposure | **Medium–High** — metrics time-series |
| Recommended policy | SELECT: internal + discovery.read. FORCE RLS. |

### 12. `creator_content_performance_baselines`

| Field | Current state |
|-------|---------------|
| RLS enabled | Yes |
| FORCE RLS | **No** |
| SELECT | `USING (true)` authenticated |
| Writes | service_role |
| Effective exposure | **Medium–High** — forecast baselines |
| Recommended policy | Same as metrics history |

---

## Related proprietary tables (adjacent)

### `intelligence.*` warehouse (10 tables)

| Field | Current state |
|-------|---------------|
| RLS | Enabled on all |
| FORCE | **No** |
| SELECT | `intelligence.can_read_intelligence()` = `is_internal_user()` AND (`intelligence.read` OR `campaigns.read`) |
| Writes | service_role (no authenticated write policies) |
| Effective exposure | **Low for portal** — model to copy for CI core |
| Gap vs Finance | Missing FORCE RLS |

### `campaign_intelligence_profiles` / `campaign_intelligence_documents`

| Field | Current state |
|-------|---------------|
| RLS | Enabled; evolved via multiple fix migrations |
| FORCE | **No** |
| SELECT | `created_by = auth.uid()` OR `can_access_campaign_intelligence_profile(id)` |
| Writes | Scoped insert/update (permission + access helpers) |
| Effective exposure | **Lower** — not `USING (true)`; still add FORCE + confirm portal cannot satisfy access helper |

### Finance `forecast_versions` / `forecast_lines`

Out of Creator Intelligence domain (planning engine / `planning.*` permissions). Do not mix into CI migration.

---

## Permissive policy inventory (`USING (true)`)

| Policy name | Table | Command | Role |
|-------------|-------|---------|------|
| `creator_dna_read` | `creator_dna` | SELECT | authenticated |
| `creator_dna_staging_read` | `creator_dna_staging` | SELECT | authenticated |
| `creator_dna_versions_read` | `creator_dna_versions` | SELECT | authenticated |
| `creator_dna_lineage_events_read` | `creator_dna_lineage_events` | SELECT | authenticated |
| `creator_intelligence_read` | `creator_intelligence` | SELECT | authenticated |
| `ipl_refresh_policies_read` | `ipl_refresh_policies` | SELECT | authenticated |
| `ipl_provider_runs_read` | `ipl_provider_runs` | SELECT | authenticated |
| `ipl_snapshots_read` | `ipl_snapshots` | SELECT | authenticated |
| `ipl_reprocess_jobs_read` | `ipl_reprocess_jobs` | SELECT | authenticated |
| `creator_enrichment_runs_read` | `creator_enrichment_runs` | SELECT | authenticated |
| `influencer_metrics_history_select_authenticated` | `influencer_metrics_history` | SELECT | authenticated |
| `creator_content_baselines_select_authenticated` | `creator_content_performance_baselines` | SELECT | authenticated |

No CI-core `WITH CHECK (true)` write policies found. DNA writes are permission/owner-scoped but **not** portal-excluded via `is_internal_user()`.

---

## Portal / PostgREST exposure assessment

| Question | Answer |
|----------|--------|
| Do portal JWTs use role `authenticated`? | Yes (Supabase Auth default) |
| Do UI portal routes query these tables? | **No** app `.from(...)` in portal routes found |
| Can portal users query via PostgREST/SDK anyway? | **Yes** — SELECT policies allow it if table GRANT SELECT exists |
| Does app middleware stop REST? | **No** — PostgREST is independent of Next.js workspace auth |
| Amplifiers | Non-HttpOnly session cookies (SEC-011); any XSS can call REST as the victim |

**Highest value targets for an authenticated portal attacker:** `ipl_snapshots`, `creator_dna` (+ versions), `creator_intelligence`.

---

## Comparison to Finance domain

Finance P0 (`20260724150000_*`):

1. Dropped `USING (true)` / `WITH CHECK (true)` on control tables  
2. Helpers: `can_read_finance_control()` / `can_write_*` wrapping **`is_internal_user()` + `has_permission('finance.*')`** + entity scope  
3. Applied **`FORCE ROW LEVEL SECURITY`**  
4. App-layer gates aligned with permissions  

Creator Intelligence should mirror with discovery/intelligence permission slugs instead of finance.

---

## Least-privilege policy design (proposed — not applied)

### Helpers (new)

```sql
-- Pseudocode design only
can_read_creator_intelligence() :=
  is_admin()
  OR (
    is_internal_user()
    AND (
      has_permission('discovery.read')
      OR has_permission('discovery.admin')
      OR has_permission('intelligence.read')
    )
  );

can_write_creator_intelligence() :=
  is_admin()
  OR (
    is_internal_user()
    AND (
      has_permission('discovery.write')
      OR has_permission('discovery.admin')
    )
  );

-- Optional: keep owner write for DNA only when is_internal_user()
can_write_creator_dna_row(influencer_id) :=
  can_write_creator_intelligence()
  OR (is_internal_user() AND influencers.created_by = auth.uid());
```

### Per-table target

| Table | SELECT | INSERT | UPDATE | DELETE | FORCE |
|-------|--------|--------|--------|--------|-------|
| `creator_dna` | `can_read_*` | `can_write_dna_row` | `can_write_dna_row` | deny / admin | Yes |
| `creator_dna_staging` | `can_read_*` | write helper | write helper | deny | Yes |
| `creator_dna_versions` | `can_read_*` | write helper | deny | deny | Yes |
| `creator_dna_lineage_events` | `can_read_*` | write helper | deny | deny | Yes |
| `creator_intelligence` | `can_read_*` | deny (service) | deny | deny | Yes |
| all `ipl_*` | `can_read_*` | deny (service) | deny | deny | Yes |
| `creator_enrichment_runs` | `can_read_*` | deny (service) | deny | deny | Yes |
| `influencer_metrics_history` | `can_read_*` | deny (service) | deny | deny | Yes |
| `creator_content_performance_baselines` | `can_read_*` | deny (service) | deny | deny | Yes |
| `intelligence.*` | keep `can_read_intelligence` | — | — | — | **Add FORCE** |
| CIP tables | keep scoped policies | keep | keep | keep | **Add FORCE** |

### Grant hygiene

- Revoke `INSERT/UPDATE/DELETE` on IPL / `creator_intelligence` from `authenticated` (RLS already blocks; grants are misleading).  
- Ensure `creator_enrichment_runs` grants match intended model after hardening.  
- Workers continue on **service_role** (no app change required for BullMQ enrichment/IPL).

---

## Required migration plan (Development first — not executed)

| Step | Action | Env |
|------|--------|-----|
| 1 | Confirm permissions `discovery.read` / `discovery.write` / `discovery.admin` / `intelligence.read` exist and are granted to internal roles that need Discovery/DNA/Forecast UI | Dev |
| 2 | Add helpers `can_read_creator_intelligence`, `can_write_creator_intelligence`, DNA owner helper | Dev migration |
| 3 | DROP + CREATE SELECT policies replacing `USING (true)` on all 12 core tables | Dev |
| 4 | Tighten DNA write policies with `is_internal_user()` | Dev |
| 5 | `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on all CI core (+ optionally warehouse + CIP) | Dev |
| 6 | Revoke excess authenticated DML grants | Dev |
| 7 | SQL regression suite (portal JWT denied; staff with discovery.read allowed; service_role write OK) — mirror `supabase/tests/rls/finance_fx_p0_regression.sql` | Dev |
| 8 | UAT: Discovery browse/DNA, AI Search, CIP, Forecasting, Control Center | Dev app |
| 9 | Explicit approval → apply same migration to Production | Prod |

**Do not** ship FORCE-only without replacing SELECT policies (would still leave `USING (true)` for table owners; FORCE mainly stops BYPASSRLS table-owner escape).

---

## Estimated product impact

| Surface | Impact if least-privilege applied correctly |
|---------|-----------------------------------------------|
| **Discovery** (browse, import, DNA panels) | **None** for staff with `discovery.read`/`write` via user-scoped server clients. Breakage only if roles lack those permissions. |
| **AI Search / Discovery intelligence RPCs** | Warehouse already gated; CI projection reads need `discovery.read` or `intelligence.read` on calling role. |
| **Campaign Intelligence (CIP)** | Minimal — already scoped; FORCE is additive. Elevated service_role paths unchanged. |
| **Forecasting** | Server loaders using user session need `discovery.read`; worker/service_role paths unchanged. |
| **DNA UI / Control Center** | Same as Discovery; owner-based DNA writes preserved for internal owners. |
| **Internal dashboards** | Must use roles with discovery/intelligence read — verify Viewer/AM matrices. |
| **Client / Creator portals** | **Intentional break** of any direct REST access (desired). UI already does not query these tables. |
| **Discovery worker / enrichment / IPL jobs** | **None** — service_role bypasses RLS. |

---

## Risk summary

| Risk | Severity |
|------|----------|
| Portal or any authenticated JWT reads `ipl_snapshots` / DNA via REST | **Critical / High** |
| Misleading CRUD grants on IPL/CI | Medium (defense-in-depth) |
| No FORCE RLS (table owner / future BYPASS patterns) | Medium |
| DNA write path lacks `is_internal_user()` | Medium (portal with stolen discovery perms unlikely; still incomplete) |
| `creator_enrichment_runs` grant drift across envs | Medium |

---

## Constraints honored (assessment phase)

Assessment itself created no migrations. Remediation applied **Development-only** on 26 Jul 2026 — see `CREATOR_INTELLIGENCE_RLS_VALIDATION_2026-07-26.md`. Production still requires explicit approval.
