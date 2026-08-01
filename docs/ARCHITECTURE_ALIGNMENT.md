# Architecture Alignment — Codebase vs System Reference

This document compares the **current Thinkway platform** (`thinkway-platform`) against the [System Reference](./THINKWAY_SYSTEM_REFERENCE.md). Use it before new modules: compare → detect gaps → recommend → avoid duplicate entities.

**Last reviewed:** Aug 2026 (Platform UX & Business Process Architecture — review package)

### Platform UX & Business Process Architecture (Aug 2026) — FINAL REVIEW

- **Status:** Approved in principle · Stakeholder Journey layer added — awaiting **final** Product approval — **no implementation yet**
- **Package:** [`docs/architecture/platform-ux/README.md`](./architecture/platform-ux/README.md)
- **Thesis:** Workflow-driven enterprise OS; Business Process Navigation + Stakeholder Journey Architecture on one campaign spine; portals/Reporting/AI extend journeys
- **Stakeholder journeys:** Internal Ops · Commercial · Client · Vendor · Creator · Finance · Executive · AI Assistant — [`11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md`](./architecture/platform-ux/11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md)
- **Preserves:** Campaign Module Baseline · Financial Display · Deliverables selection · calculations/APIs/DB
- **Next after final approval:** Phase 1 Campaign Process Navigation only (see migration strategy)

### Campaign Module Baseline — PROTECTED (Aug 2026)

- **Initiative:** Campaign Information Architecture — **CLOSED permanently**
- **Protected record:** [`docs/architecture/CAMPAIGN_MODULE_BASELINE.md`](./architecture/CAMPAIGN_MODULE_BASELINE.md)
- **Product UX standards:** [`docs/architecture/PRODUCT_UX_STANDARDS.md`](./architecture/PRODUCT_UX_STANDARDS.md) — Campaign is canonical for workspace/nav/KPI/tabs/finance presentation patterns
- **Includes:** Campaign IA · Workspace UI · Enterprise Tabs · Financial Display Standard · Deliverables selection · Persistent shell
- **Next work (functional only):** Planning Board (2.2a) → Media Plan Copilot (2.2b) → Vendor IO Enterprise Completion → Reporting Hub → Notifications → Enterprise Analytics
- **Low debt (non-blocking):** [`CAMPAIGN_MODULE_TECHNICAL_DEBT.md`](./architecture/CAMPAIGN_MODULE_TECHNICAL_DEBT.md)
- **Rule:** No Campaign redesign unless Critical usability + formal Product approval

### Financial Display Standard (Aug 2026)

- **ISO currency codes only** (`EGP 1,235,561` / `EGP 1,235,561.00`) — never `$` / `E£` / locale glyphs for display.
- **Canonical formatter:** `lib/finance/currency-format.ts` (`formatMoneyKpi` / `formatMoneyDetail`).
- Spec: [`docs/architecture/FINANCIAL_DISPLAY_STANDARD.md`](./architecture/FINANCIAL_DISPLAY_STANDARD.md). Presentation only — no calculation changes.

### Campaign Workspace UI Design Freeze (Aug 2026)

- **Frozen under Campaign Module Baseline:** Presentation of `/campaigns/[id]` Aurora Campaign Workspace.
- **Docs:** [`CAMPAIGN_WORKSPACE_UI_FREEZE.md`](./architecture/CAMPAIGN_WORKSPACE_UI_FREEZE.md) · [`CAMPAIGN_WORKSPACE_UI_GUIDELINES.md`](./architecture/CAMPAIGN_WORKSPACE_UI_GUIDELINES.md) · baseline above.
- Does **not** freeze APIs, schema, workflows, or business rules.

### Release 2.0 — Enterprise Campaign Lifecycle (Jul 2026)

Architecture package (pre-implementation, awaiting approval): [`docs/release/2.0/`](./release/2.0/README.md).  
Preserves this doc’s rule: **`campaign_lines` = Assignment / PO unit** — do not invent a parallel assignments table. Quotation remains commercial SSOT; convert projects lean Assignments once.

### Vendor IO & invoice lifecycle (Jun 2026)

| Capability | Status |
|------------|--------|
| Manual **Generate Vendor IO** from assignment lines (grouped by influencer) | ✅ Phase 1 |
| `campaign_lines.operational_status` + `vendor_io_id` gate | ✅ Phase 1 (migration `20260605010000`) |
| Invoice queue on campaign Billing tab | ✅ Phase 1 |
| Append only to unlocked, same-campaign invoices | ✅ (`is_operational_locked` + regeneration status) |
| Invoice number preserved on ungenerate | ✅ (existing governance) |
| VIO revision suffix `/1`, `/2` (new row, supersede prior) | ✅ Phase 2 |
| Post-invoice `operational_status` sync (single helper) | ✅ Phase 2 |
| Append when `partially_invoiced` / `reopened` | ✅ Phase 2 |
| Invoice HTML preview | ✅ Phase 2a · PDF export ⏳ Phase 2b |
| One-time invoice data reset migration | ⚠️ Requires explicit `supabase db push` approval |

---

## 1. Hierarchy & data model — aligned

| Reference | Codebase | Status |
|-----------|----------|--------|
| Group → Client → Brand | `groups` → `clients` → `brands` | ✅ Aligned |
| Brand-first campaign create | `createCampaignAction` uses `brand_id`; trigger syncs header | ✅ Aligned |
| Campaign header (Level 1) | `campaign_headers` | ✅ Aligned |
| Campaign line (Level 2) | `campaign_lines` with `-A/-B` numbering | ✅ Aligned |
| Vendor master | `influencers`, `agencies`, `influencer_platform_accounts` | ✅ Aligned (terminology: UI "Vendors") |
| VR% master | `md_vr_rates` + brand/header FK | ⚠️ Partial — see §4 |
| Master data tables | `md_categories`, `md_subcategories`, `md_teams`, etc. | ✅ Aligned |

### Intentional deviation (do not revert)

**Commercial fields on brand, not client.** Reference §3.2 lists category, VR%, direct/agency on client master. The codebase correctly normalizes these onto **brands** because one legal entity may operate multiple brands with different commercial terms. Campaign headers inherit from brand via `sync_campaign_header_from_brand`.

### Semantic nuance — Level 2 lines

| Reference | Codebase |
|-----------|----------|
| Level 2 = one **influencer line** per suffix (`-A`, `-B`) with vendor, IO, billing | `campaign_lines` = financial/PO lines; `campaign_influencers` = vendor assignments (optional `campaign_line_id`) |

**Recommendation:** Treat `campaign_lines` as the operational PO unit (reference Level 2). When a line represents a single creator, set `vendor_id` semantics via primary `campaign_influencer` on that line. Avoid a third parallel "line" entity. Document in UI: "Line A = PO + economics; assign vendor(s) on Vendors tab."

---

## 2. Operational workspaces — in progress

| Module | Route | Reference tabs / scope | Status |
|--------|-------|------------------------|--------|
| Groups | `/groups/[id]` | Overview, legal entities, brands, documents, financial, activity | ✅ Built |
| Legal entities | `/clients/[id]` | Overview, brands, legal, finance, documents, campaigns | ✅ Built |
| Campaigns | `/campaigns/[id]` | Overview, Assignments, Client IO, Vendor IO, deliverables, performance, workflow, finance, timeline | ✅ Built · **UI frozen** (Aurora R2.3, 2026-08-01) |
| Vendors | `/vendors/[id]` | Overview, legal, finance, documents, platforms, campaigns | ✅ Built |

**Gap:** Workspaces exist but many fields from reference §5.1/§5.2 are not yet on forms (Thinkway PO entity, GR#, achievement, ad-live month, moved-to-billing, invoice #, line lock).

---

## 3. Missing entities (reference vs DB)

Entities in reference **not yet implemented** as first-class modules:

| Entity / table (reference) | Purpose | Recommendation |
|----------------------------|---------|----------------|
| `workflow_rules`, `workflow_templates`, `workflow_actions` | Conditional approval orchestration (§20) | Phase 2 — extend existing `approvals`/`approval_steps`; add rules table when triggers needed |
| `notifications`, `notification_preferences`, `notification_logs` | Alert center (§21) | Phase 2 — new feature module; hook into approval/onboarding events |
| `tasks`, `subtasks`, `task_comments`, `task_attachments` | Internal ops tasks (§22) | Phase 2 — separate from `deliverables` (creator-facing) |
| `assets`, `asset_versions`, `usage_rights` | DAM (§23) | Phase 2 — storage buckets + metadata; link to campaigns/clients |
| `contracts`, `contract_versions`, `contract_signatures` | Legal lifecycle (§24) | Phase 2 — extend document uploads pattern (`group_documents`, `client_documents`) |
| `budgets` (5 versions/year) | Budget module (§11) | Phase 1 backlog — schema stub in reference; not in app migrations yet |
| `bonus_setups`, `bonus_runs` | Bonus module (§12) | Phase 1 backlog — HTML prototype exists; not in Next app |
| Analytics warehouse layer | Historical BI (§30) | Phase 4 — do not duplicate operational tables |
| Creator / client portals | External auth + scoped RLS (§26–27) | Phase 2/4 — separate auth profiles or Supabase custom claims |

**Do not duplicate:** Use existing `deliverables`, `invoices`, `payments`, `approvals`, `audit_logs` before creating parallel tables.

---

## 4. Partial / incomplete entities

| Area | Have | Missing vs reference |
|------|------|----------------------|
| **Clients** | Core fields, documents, onboarding data columns | Client code `C-XXX`, client type New/Existing/L'Oréal, 5-stage onboarding workflow, service model, payment guarantee, sanction check, finance/contact split |
| **Brands** | Category, VR%, currency, agency/direct | Client-type-specific rules; brand-level contract terms |
| **Campaign header** | Brand sync, dates, status, account manager, team | Thinkway PO legal entity, client PO file/number/amount, GR#, achievement, report type, sales person, end report upload |
| **Campaign line** | PO, revenue, cost, GP, platform, remaining_po | Ad-live month/date, budget month, campaign type, went live, week, **billing fields** (moved to billing, invoiced, INV#, vendor paid, locked) |
| **Billing** | Operational invoice flow, Vendor IO gate (`operational_status`), campaign billing queue, append/ungenerate | Proof of payment upload, full finance queue export, VIO `/n` revision suffix UI |
| **VR%** | `md_vr_rates` on brand | Group/client override resolution (§9.2); admin CRUD UI |
| **Roles** | Supabase auth + partial RLS | Full 6-role matrix (§6), CM scoping, Data Entry financial column hiding |
| **Reports** | None in app | All 10 standard reports + custom builder (§14) |
| **Admin** | Nav stubs | Users, roles, system settings, audit UI (§17) |
| **Discovery** | `discovered_profiles` + worker service (`services/discovery-worker`) | Brief/AI match UI, shortlists ✅ Phase 1; client report export ⏳ |

---

## 5. Missing workflows & approvals

| Workflow | Reference | Codebase status |
|----------|-----------|-----------------|
| Client onboarding (5 stages) | §4 | ❌ No stage machine; documents exist |
| Client Finance approval → Active + C-XXX | §4 Stage 4 | ❌ No approval queue UI |
| New → Existing conversion | §4 Stage 5 | ❌ No rule/threshold job |
| Campaign lock on invoice | §2.2, §10.1 | ❌ No `locked` column enforcement on lines |
| Billing: moved → invoiced → vendor paid | §10 | ⚠️ Derived statuses only; no write workflow |
| Bonus: Calculate → FBP → CEO → HR | §12.6 | ❌ Not in app |
| Conditional approvals (>$50k, margin <15%, etc.) | §20.2 | ❌ `approvals` table exists; no rule engine |
| 15-stage campaign lifecycle | §29 | ⚠️ Simplified 6-stage workflow in UI; not full pipeline |
| Deliverable documentation | §22.2 / assets | ⚠️ Ops explorer only today. **Target (proposal):** Documentation & Asset Repository SSOT — not workflow/Publication/Performance — [`architecture/DELIVERABLES_DOCUMENTATION_REPOSITORY.md`](./architecture/DELIVERABLES_DOCUMENTATION_REPOSITORY.md) |

**Recommendation (Phase 1 priority):**

1. Add **line billing columns** to `campaign_lines` (or line metadata JSON with typed keys): `moved_to_billing`, `invoiced`, `invoice_number`, `vendor_paid`, `locked`, `ad_live_date`, `budget_month`, `campaign_type`.
2. Implement **invoice generation action** that sets INV#, locks line, writes audit log.
3. Implement **client onboarding state** on `clients`: `onboarding_stage`, `submitted_at`, `approved_by` — reuse `approvals` for Stage 4.
4. Add **workflow_rules** only when conditional routing is required; until then use entity-specific approval rows.

---

## 6. Missing reporting dimensions

Reference reports (§14) require these dimensions to be queryable:

| Dimension | Source today | Gap |
|-----------|--------------|-----|
| Client / group / brand | ✅ FKs on header | — |
| Account Director / Director hierarchy | ⚠️ `account_manager_id`, group AD | Need `profiles.reports_to_id` + CM mapping |
| Team (OPS / Iman) | ⚠️ `team_id` → `md_teams` | Seed teams; enforce on header |
| Month (ad live, budget) | ❌ | Add to lines |
| Channel / platform | ⚠️ line platform + metadata | Multi-channel array on line |
| Category / subcategory | ✅ via brand | — |
| Director (for revenue report) | ❌ | User hierarchy |
| Invoice / payment state | ⚠️ campaign-level invoices | Line-level billing linkage |
| CM / sales person | ❌ | `sales_person_id` on header |

**Recommendation:** Add nullable FKs/reporting fields to `campaign_headers` / `campaign_lines` rather than new aggregate tables. Build reporting views in SQL (`campaign_reporting_v`) for Phase 1 reports.

---

## 7. Terminology improvements (UI)

| Avoid | Prefer | Notes |
|-------|--------|-------|
| Clients (alone) | Legal entities | Sidebar already uses "Legal Entities" |
| CRUD / "New X" pages | Workspace / operational profile | Pattern established |
| Campaign (flat) | Campaign header + lines | Show document numbers |
| Influencer (internal) | Vendor | Match reference §8; link to vendor master |
| Country Manager | Account Director | Reference §7.2 rename |
| Posted | Published | DB `published`; UI "Posted" ok for deliverables |
| PO amount | Client PO / IO amount | Clarify client vs vendor economics |

---

## 8. UX structure recommendations

### Workspace tab standard (all operational profiles)

1. Sticky KPI strip (aggregates from lines/children)  
2. Overview (identity + hierarchy links + edit sheet)  
3. Domain tabs (lines, vendors, deliverables, etc.)  
4. Financial summary tab  
5. Workflow / approvals tab  
6. Timeline & audit tab  

### Campaign workspace — next increments

| Priority | Feature |
|----------|---------|
| P0 | Line billing fields + Finance write actions |
| P0 | Line lock when invoiced |
| P1 | Ad-live date, budget month, campaign type on lines |
| P1 | Header: client PO upload, Thinkway PO entity |
| P1 | Role-based column visibility (hide financials for Data Entry) |
| P2 | 15-stage lifecycle Kanban (metadata or `campaign_stage` enum) |
| P2 | Notification on approval assign |

### Client workspace — next increments

| Priority | Feature |
|----------|---------|
| P0 | Onboarding stage indicator + approval queue |
| P1 | Client code display after finance approval |
| P1 | External form link generation |

---

## 9. Finance operations alignment

| Reference rule | Implementation path |
|----------------|---------------------|
| Profit/margin auto-calc | ✅ DB trigger `compute_campaign_line_financials` |
| Remaining PO | ✅ `remaining_po` on lines |
| Multi-currency + USD base | ✅ `revenue_base`, `cost_base`, `fx_rate` |
| Invoice > PO warning | ❌ Add check in invoice create action |
| Margin threshold approval | ❌ Workflow rule → `approvals` row |
| Vendor paid requires proof | ❌ Require `payments` + attachment before status |
| FX revaluation | Phase 2 — finance module |
| Multi-entity (UAE/KSA/KWT PO legal entity) | Add `thinkway_legal_entity_id` on header |

---

## 10. Conflict resolution log

| Reference | Codebase decision | Action |
|-----------|-------------------|--------|
| Commercial fields on client (§3.2) | On brand | **Keep brand model**; update reference interpretation |
| `campaigns` table | View over headers | **Keep**; writes go to `campaign_headers`/`campaign_lines` |
| Level 2 = influencer only | Lines + assignments | **Keep both**; clarify mapping in UI/docs |
| `vendors` table name | `influencers` | **Keep** table name; UI "Vendor" |
| KWD currency | USD/AED/SAR/EGP/EUR in app | **Add KWD** to currency enum when required |

---

## 11. Suggested implementation order (Phase 1 completion)

```
1. campaign_lines billing + lock columns (migration)
2. Billing write flows (generate invoice, mark vendor paid)
3. Client onboarding stage machine + finance approval
4. profiles.reports_to_id + role enum + RLS policies
5. Dashboard KPIs (billing metrics §10.2)
6. Reports 1, 2, 5, 6 (SQL views + export)
7. Admin: users, VR%, audit log UI
8. Budget + Bonus modules (separate feature flags)
```

---

## 12. Files to consult when building

| Concern | Location |
|---------|----------|
| Product spec | `docs/THINKWAY_SYSTEM_REFERENCE.md` |
| This gap analysis | `docs/ARCHITECTURE_ALIGNMENT.md` |
| DB schema | `supabase/schema.sql`, `supabase/migrations/` |
| Hierarchy migration | `supabase/migrations/20260531140000_enterprise_hierarchy.sql` |
| Group workspace pattern | `features/groups/` |
| Campaign workspace pattern | `features/campaigns/` |
| Master data | `lib/master-data/` |
| Cursor rule | `.cursor/rules/thinkway-product-reference.mdc` |

---

*When in doubt: preserve hierarchy, extend existing tables, build workspaces not CRUD pages, and log gaps here before adding new entities.*
