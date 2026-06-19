# Role & Permission Matrix — Thinkway Platform

**Scope:** Map production roles to capabilities; compare system reference §6 vs codebase implementation.  
**Sources:** `docs/THINKWAY_SYSTEM_REFERENCE.md` §6, `supabase/seed.sql`, `supabase/migrations/*` (permission inserts), `lib/auth/permissions.ts`, `features/settings/constants.ts`

---

## Role model overview

### System reference (6 roles)

| Reference role | Intended scope |
|----------------|----------------|
| Admin | Full access; users, roles, categories, audit |
| Director | Own team; approve clients; delete/lock campaigns |
| Manager | Add/edit campaigns & clients; view all campaigns |
| Account Manager | Own CM campaigns; financials; own edits only |
| Finance | Billing full; view campaigns/reports; no campaign edit |
| Data Entry | Own entries only; **no financials** |

### Codebase (8 roles)

| DB slug | UI name | Type |
|---------|---------|------|
| `super_admin` | Super Admin | Internal — all permissions |
| `admin` | Admin | Internal — all permissions (operational parity with super_admin) |
| `account_manager` | Account Manager | Internal — clients/campaigns/deliverables write |
| `finance` | Finance | Internal — invoices/payments/audit read |
| `operations` | Operations | Internal — campaigns/influencers/deliverables write |
| `viewer` | Viewer | Internal — read-only clients/campaigns/analytics |
| `client_user` | Client User | Portal — scoped client access |
| `influencer` | Influencer | Portal — own deliverables |

**There is no `director`, `manager`, `data_entry`, or `campaign_manager` role slug in the database.**  
`campaign_manager` appears only as a **financial approval stage** label in `features/billing/constants.ts`, not as an auth role.

---

## Requested role mapping (go-live program)

| Go-live role | Maps to codebase | Notes |
|--------------|------------------|-------|
| **Super Admin** | `super_admin` | Full bypass in `requirePermission()` |
| **Finance** | `finance` | + extended permissions from finance migrations |
| **Sales** | `account_manager` + `profiles.business_function = 'sales'` | Business function is metadata only; **not enforced in RLS** |
| **Operations** | `operations` | Campaign execution, influencers, deliverables |
| **Campaign Manager** | `account_manager` (reference: Account Manager) | Own-client scoping via `client_users` / campaign membership |
| **Viewer** | `viewer` | Minimal read |

---

## Permission slugs (canonical)

From `supabase/seed.sql` and subsequent migrations:

| Module | Read | Write | Delete | Approve | Other |
|--------|------|-------|--------|---------|-------|
| Clients | `clients.read` | `clients.write` | `clients.delete` | — | — |
| Campaigns | `campaigns.read` | `campaigns.write` | `campaigns.delete` | — | — |
| Influencers | `influencers.read` | `influencers.write` | `influencers.delete` | — | — |
| Deliverables | `deliverables.read` | `deliverables.write` | `deliverables.delete` | — | — |
| Invoices | `invoices.read` | `invoices.write` | `invoices.delete` | — | — |
| Payments | `payments.read` | `payments.write` | `payments.delete` | — | — |
| Approvals | `approvals.read` | `approvals.write` | `approvals.delete` | `approvals.decide` | — |
| Users | `users.read` | `users.write` | — | — | `users.invite` |
| Audit | `audit.read` | — | — | — | — |
| Analytics | `analytics.read` | — | — | — | — |
| Client IO | `client_ios.read` | `client_ios.write` | — | — | — |
| Vendor IO | `vendor_ios.read` | `vendor_ios.write` | — | — | — |
| IO workflow | — | — | `ios.delete` | `ios.approve` | — |
| Planning | `planning.read` | `planning.write` | — | `planning.approve` | — |
| Collections | `collections.read` | `collections.write` | — | — | — |
| Treasury | `treasury.read` | — | — | — | — |
| Settings | `settings.read` | `settings.write` | — | — | `roles.*`, `access_control.*` |
| Publications | `publications.*` | | | | |
| Portals | `client_portal.*`, `creator_portal.*` | | | | |
| Finance control | `finance.periods`, `finance.override` | | | | From governance migrations |
| Discovery | `discovery.read`, `discovery.write` | | | | |
| Intelligence | `intelligence.read` | | | | |

Settings UI matrix: `features/settings/components/permissions-matrix.tsx` + `SETTINGS_MODULES` in `features/settings/constants.ts`.

---

## Capability matrix — who can do what

Legend: ✅ = granted by seed/migrations · ⚠️ = partial / UI-only · ❌ = not granted · 🔧 = admin/super_admin bypass

### Clients (legal entities)

| Action | Super Admin | Admin | Finance | Operations | Account Mgr | Viewer | Reference (Manager) |
|--------|:-----------:|:-----:|:-------:|:----------:|:-----------:|:------:|:-------------------:|
| Create client | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ Manager |
| Edit client | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Delete/archive client | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | — |
| Upload client documents | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Classification review | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | — |
| Finance approval (onboarding) | ✅ | ✅ | ✅ decide | ❌ | ❌ | ❌ | Finance/Admin |

**Enforcement:** RLS `clients_insert/update` requires `clients.write` + `can_access_client()`.  
**App layer:** `features/clients/actions.ts` — auth user only; relies on RLS for permission denial.

### Campaigns

| Action | Super Admin | Admin | Finance | Operations | Account Mgr | Viewer |
|--------|:-----------:|:-----:|:-------:|:----------:|:-----------:|:------:|
| Create campaign | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Edit campaign | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Delete/cancel campaign | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ |
| Assign influencers | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| View financials on lines | ✅ | ✅ | ✅ read | ✅ | ✅ | ❌ |

**Reference gap:** Director delete/lock campaigns — no `director` role; only admin has `campaigns.delete`.

### Vendor IO

| Action | Super Admin | Admin | Finance | Operations | Account Mgr | Viewer |
|--------|:-----------:|:-----:|:-------:|:----------:|:-----------:|:------:|
| Generate Vendor IO | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Revise / ungenerate VIO | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Export PDF/HTML | ✅ | ✅ | ✅ read | ✅ | ✅ | ❌ |
| External vendor approve | Token (anon RPC) | — | — | — | — | — |

**App:** `features/io/generate-vendor-io-action.ts` — auth only; eligibility rules in DB/helpers.

### Client IO

| Action | Super Admin | Admin | Finance | Operations | Account Mgr | Viewer |
|--------|:-----------:|:-----:|:-------:|:----------:|:-----------:|:------:|
| Generate Client IO | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Export PDF/HTML | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Email send | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

Permissions: `client_ios.read/write` granted in `20260603001000_thinkway_io_system.sql`.

### Billing & invoices

| Action | Super Admin | Admin | Finance | Operations | Account Mgr | Viewer |
|--------|:-----------:|:-----:|:-------:|:----------:|:-----------:|:------:|
| Move line to billing | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| Create invoice | ✅ | ✅ | ✅ | ❌ | ⚠️ read | ❌ |
| Regenerate invoice | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve for billing | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Finance override | 🔧 | 🔧 | ✅ | ❌ | ❌ | ❌ |
| Record vendor payment | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

**App:** `features/billing/actions.ts` uses `requirePermission()` for some paths; not all billing actions verified at app layer.

### Finance module (periods, posting, VAT)

| Action | Super Admin | Admin | Finance | Others |
|--------|:-----------:|:-----:|:-------:|:------:|
| Financial periods | ✅ | ✅ | ✅ `finance.periods` | ❌ |
| Posting center | ✅ | ✅ | ✅ | ❌ |
| VAT adjustments | ✅ | ✅ | ✅ | ❌ |

**App:** `features/finance/actions.ts` — `requirePermission(supabase, "finance.periods")`.

### Reports & analytics

| Action | Super Admin | Admin | Finance | Operations | Account Mgr | Viewer |
|--------|:-----------:|:-----:|:-------:|:----------:|:-----------:|:------:|
| Executive dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export P&L / reports (API) | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ |
| Reference 10 standard reports | ⚠️ partial | | | | | |

**Gap:** Reference §12 ten standard reports — app has analytics/P&L routes but not full report catalog.

### Admin / settings

| Action | Super Admin | Admin | Others |
|--------|:-----------:|:-----:|:------:|
| Invite users | ✅ | ✅ | ❌ |
| Change roles | ✅ | ✅ | ❌ |
| Permissions matrix | ✅ | ✅ | Read-only settings for finance/ops/AM |
| Audit logs | ✅ | ✅ | Finance read |

**App:** `features/settings/actions.ts` — admin or `settings.write` / `users.invite`.

---

## Scoping rules

| Mechanism | Location | Behavior |
|-----------|----------|----------|
| `can_access_client(client_id)` | RLS helpers | Client portal users + assigned account managers |
| `can_access_campaign_header(id)` | RLS | Campaign team / client linkage |
| `client_users` table | Migrations | Explicit client ↔ profile grants |
| `campaign_members` | Schema | Campaign-level team |
| `is_internal_user()` | Schema | Blocks portal users from internal writes |

**Reference gap:** "Account Manager scoped by CM/Director hierarchy" — **director hierarchy not modeled**; only account manager assignment on clients/campaigns/groups (`account_director_id` on groups is a profile FK, not a role).

---

## Gaps vs system reference

| # | Reference expectation | Current state | Impact |
|---|----------------------|---------------|--------|
| 1 | 6 roles including Director, Manager, Data Entry | 8 different slugs; no director/manager/data_entry | **High** — cannot enforce reference matrix literally |
| 2 | Finance cannot edit campaigns | ✅ Finance lacks `campaigns.write` in seed | Aligned |
| 3 | Data Entry — no financials | No data_entry role; viewer sees analytics | **Medium** |
| 4 | Manager views all campaigns | operations/account_manager scoped by access helpers | **Medium** |
| 5 | Director approves clients | Finance/admin decide; no director role | **Medium** |
| 6 | CM financial column hiding for Data Entry | Not implemented at UI layer | **Medium** |
| 7 | Business function (Sales vs OPS) | `profiles.business_function` — display/filter only | **Low** |
| 8 | Settings permissions matrix editable | UI read-only matrix; changes via DB seed/migrations | **Low** |

---

## Application-layer enforcement coverage

| Pattern | Files | Coverage |
|---------|-------|----------|
| `requirePermission()` | `features/billing/actions.ts`, `features/finance/actions.ts`, `features/planning/actions.ts`, `features/collections/actions.ts` | Finance/planning paths |
| Auth user only | `features/clients/actions.ts`, `features/io/*`, many campaign actions | Relies on RLS |
| Admin role check | `features/settings/actions.ts`, `features/client-access/actions.ts` | Settings/client access |
| RLS only | Most Supabase queries from server components | Primary enforcement |

**Recommendation:** Treat RLS as source of truth; add `requirePermission()` to all mutating server actions for defense in depth and clearer error messages.

---

## Recommended role assignment for go-live

| Persona | Assign role | Optional |
|---------|-------------|----------|
| Platform owner | `super_admin` | — |
| IT / ops admin | `admin` | — |
| Finance team | `finance` | — |
| Campaign ops | `operations` | `business_function: ops` |
| Client-facing AM | `account_manager` | `business_function: sales` |
| Read-only leadership | `viewer` | — |
| External client | `client_user` + `client_users` row | — |
| External creator | `influencer` | — |

**Do not** use `super_admin` for daily operators.

---

## Cross-references

- `docs/SECURITY_AUDIT.md` — ESC-01 role escalation, RLS details
- `docs/THINKWAY_SYSTEM_REFERENCE.md` §6
- `docs/ARCHITECTURE_ALIGNMENT.md` §4 (Roles partial)
- `docs/UAT_CHECKLIST.md` — role-based test scenarios
