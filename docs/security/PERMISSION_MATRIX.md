# Permission Matrix — Thinkway Platform

**Release:** 1.0 Phase 0.1  
**Sources:** `supabase/seed.sql`, migrations, `lib/auth/permissions.ts`

---

## Role inventory (8 system roles)

| Slug | UI name | Type |
|------|---------|------|
| `super_admin` | Super Admin | Internal — full bypass |
| `admin` | Admin | Internal — full bypass |
| `account_manager` | Account Manager | Internal |
| `finance` | Finance | Internal |
| `operations` | Operations | Internal |
| `viewer` | Viewer | Internal read-only |
| `client_user` | Client User | Portal |
| `influencer` | Influencer | Portal |

---

## Product role mapping

| Go-live role | Maps to | Notes |
|--------------|---------|-------|
| Super Admin | `super_admin` | Full platform access |
| Agency Admin | `admin` | Operational parity with super_admin |
| Campaign Manager | `account_manager` | Own-client scoping via `client_users` |
| Finance | `finance` | No `campaigns.write` |
| Creator Manager | `operations` | Discovery + influencers + campaigns |
| Client | `client_user` | Portal scoped |
| Viewer | `viewer` | Read-only |

---

## Permission slugs (canonical)

### Core modules (seed.sql)

| Module | Read | Write | Delete | Other |
|--------|------|-------|--------|-------|
| Clients | `clients.read` | `clients.write` | `clients.delete` | — |
| Campaigns | `campaigns.read` | `campaigns.write` | `campaigns.delete` | — |
| Influencers | `influencers.read` | `influencers.write` | `influencers.delete` | — |
| Deliverables | `deliverables.read` | `deliverables.write` | `deliverables.delete` | — |
| Invoices | `invoices.read` | `invoices.write` | `invoices.delete` | — |
| Payments | `payments.read` | `payments.write` | `payments.delete` | — |
| Approvals | `approvals.read` | `approvals.write` | `approvals.delete` | `approvals.decide` |
| Users | `users.read` | `users.write` | — | `users.invite` |
| Audit | `audit.read` | `audit.write` | — | — |
| Analytics | `analytics.read` | — | — | — |

### Extended modules (migrations)

| Module | Permissions |
|--------|-------------|
| IO | `client_ios.*`, `vendor_ios.*`, `ios.approve`, `ios.delete` |
| Settings | `settings.*`, `roles.*`, `access_control.*` |
| Publications | `publications.*` |
| Portals | `client_portal.*`, `creator_portal.*` |
| Finance control | `finance.periods`, `finance.override` |
| Operations | `operations.read`, `operations.write` |
| Discovery | `discovery.read`, `discovery.write`, `discovery.admin` |
| Intelligence | `intelligence.read` |
| Planning | `planning.*` |
| Collections | `collections.*`, `treasury.read` |
| AI workspace | `ai.read`, `ai.write` |

---

## Role → permission grants (summary)

| Permission area | super_admin | admin | account_mgr | finance | operations | viewer |
|-----------------|:-----------:|:-----:|:-----------:|:-------:|:----------:|:------:|
| clients.write | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| campaigns.write | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| campaigns.delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| invoices.write | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| discovery.write | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| analytics.read | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| settings.write | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| audit.read | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| operations.write | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| ai.write | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

Full seed mappings: `supabase/seed.sql` + module migrations.

---

## API permission requirements (Phase 0.1)

| Route pattern | Required permission |
|---------------|---------------------|
| `/api/reports/*/document` | `analytics.read` |
| `/api/discovery/search`, `/jobs` | `discovery.read` |
| `/api/discovery/import/files` | `discovery.write` |
| `/api/shortlists/*/export` | `discovery.read` |
| `/api/quotations/*/export` | `discovery.read` |
| `/api/invoices/*/document` | `invoices.read` |
| `/api/client-ios/*/document` | `client_ios.read` |
| `/api/vendor-ios/*/document` | `vendor_ios.read` |
| `/api/clients/*/documents` | `clients.write` |
| `/api/campaigns/influencers` | `influencers.read` |
| `/api/operations/*` | `operations.read` |
| `/api/creators/avatar` | `influencers.read` |
| `/api/creators/publication-preview` | `publications.read` |
| `/api/campaigns/*/publications-bundle` | `campaigns.read` |
| `/api/ai/*` | `ai.read` / `ai.write` |
| `/api/admin/campaign-performance/*` | `operations.read` |
| `/api/vendors/platform-accounts/enrich` | `influencers.write` |

---

## Server actions — permission status

| Area | App-layer check | RLS fallback |
|------|-----------------|--------------|
| Billing/finance actions | Partial `requirePermission()` | ✅ |
| Campaign cancel/reopen | ✅ `campaigns.write` | ✅ |
| Settings user/role | ✅ `settings.write` | ✅ |
| Discovery actions | ✅ `discovery.write` | ✅ |
| Client actions | Auth only | ✅ RLS |
| Collections | ✅ | ✅ |

**Phase B:** Extend `requirePermission()` to remaining write server actions.

---

## `has_permission()` RPC

```sql
-- Returns true when authenticated user's role has the permission slug
SELECT public.has_permission('campaigns.write');
```

Used in RLS policies and `lib/auth/permissions.ts`.
