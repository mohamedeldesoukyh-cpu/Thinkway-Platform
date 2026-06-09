# Thinkway System Reference

**Source of truth** for product, business logic, terminology, workflows, and roadmap.  
Extracted from: `Thinkway_System_Reference Updated 30-05-2026.docx` (May 2026).

Use with `docs/ARCHITECTURE_ALIGNMENT.md` when implementing features.

---

## 1. Platform identity

| Item | Value |
|------|--------|
| Product name | Thinkway |
| Campaign prefix | TW |
| Primary colour | `#1D9E75` |
| Stack | Next.js App Router · Supabase (PostgreSQL + Auth + RLS) · Vercel |

### Eight platform modules

1. **Dashboard** — KPIs, revenue charts, trends (all roles, read-only)
2. **Campaigns** — two-level header + lines (role-dependent)
3. **Client Master** — Group → Legal entity → Brand (Manager+ manage)
4. **Vendor Master** — influencers, agencies, platforms
5. **Team & Targets** — CM performance, targets, bonus
6. **Billing** — invoicing, PO, vendor payment (Finance + Director+)
7. **Reports** — 10 standard + custom builder (role-scoped)
8. **Admin** — users, roles, groups, VR%, audit (Admin only)

---

## 2. Entity hierarchy

```
Group → Client (Legal Entity) → Brand(s) → Campaign Header → Campaign Line
```

**Example:** L'Oréal (group) → L'Oréal Middle East FZE (legal entity) → Kérastase, Redken, Garnier (brands)

- **Brand is the campaign lookup key** — selecting brand auto-fills group, legal entity, category, VR%, direct/agency, currency.
- **Client code** `C-XXX` — assigned on Finance approval after onboarding.
- **Client type:** New / Existing / L'Oréal — auto-upgrade New→Existing after configurable threshold (default 3 months from first campaign).

> **Codebase note:** Category, subcategory, VR%, direct/agency, and currency are normalized on **brands** (not duplicated on clients). Campaign headers inherit from brand via DB trigger.

---

## 3. Campaign numbering

| Level | Format | Example | Rules |
|-------|--------|---------|-------|
| Header | `TW-YYYY-NNNN` | TW-2026-0001 | Year from ad-live month; 4-digit seq; resets yearly; never reused |
| Line | `{header}-A/B/C…` | TW-2026-0001-A | One suffix per line; auto-assigned |

**Lifecycle:** Create header → add lines → **lock line when invoiced** (Admin override).

---

## 4. Campaign fields (reference)

### Level 1 — Header

Campaign ID (auto), name, brand (required lookup), group/client/legal entity (auto), Thinkway PO legal entity, client PO attachment/number/amount, direct/agency, owner team, sales person, account director, report type, VR%, category, subcategory, GR#, achievement, remaining PO, end report, active/inactive.

### Level 2 — Line (influencer / PO line)

Line code (auto), campaign ref, month of ad live, ad live date, budget month, campaign type (Fixed / Hard ROI / Performance), influencer (vendor master), agent/agency, channel (multi), IO currency/amount, revenue/cost/profit/margins (auto), went live, week (auto 1–4), **billing:** moved to billing, invoiced, invoice #, vendor paid, proof of payment, locked, comments.

### Auto-calculated (DB)

- `profit = revenue - cost`
- `profit_margin = profit / revenue`
- `markup_margin = profit / cost`
- `remaining_po = po_amount - cost` (or achievement-based per ops)
- `week` from ad_live_date

---

## 5. Client onboarding (5 stages)

1. **Internal form** — AM fills profile, financial terms, documents (trade license, VAT, contract/IO)
2. **External form** — shareable link; client submits + uploads
3. **AM review** — merge data; submit for approval (cannot self-approve)
4. **Finance/Admin approval** — Approve / Reject / Request changes → Active + client code
5. **New → Existing** — flagged after threshold; Manager/Admin converts with audit

---

## 6. Roles & permissions (6 groups)

| Role | Scope |
|------|--------|
| Admin | Full access; users, roles, categories, audit |
| Director | Own team; approve clients; delete/lock campaigns |
| Manager | Add/edit campaigns & clients; view all campaigns |
| Account Manager | Own CM campaigns; financials; own edits only |
| Finance | Billing full; view campaigns/reports; no campaign edit |
| Data Entry | Own entries only; **no financials** |

Enforce at **UI + Supabase RLS**. Account Manager scoped by CM/Director hierarchy.

---

## 7. Vendor master

Fields: name, type (Influencer/Agency/Platform), handle, channels (multi), country, currency, typical rate, bank ref, linked agency, status.

Campaign linkage: pick from vendor master on line; channel/agency auto-fill; inline create allowed.

---

## 8. VR% master

Table: group or client scope, VR%, effective from.  
**Resolution:** client override → group default → blank (manual entry).  
Managed in Admin; Finance/Admin edit.

---

## 9. Billing module

### Per-line states

| Field | Values | Set by |
|-------|--------|--------|
| Moved to billing | Not Moved / Moved | Manager, Director, Finance |
| Invoiced | Yes / No | Finance |
| Invoice number | INV-XXXXX | Finance |
| Vendor paid | Not paid / Paid | Finance |
| Proof of payment | File/link | Auto after payment recorded |
| Locked | Unlocked / Locked | Auto on invoiced; Admin override |

### Dashboard metrics

Moved / not moved / invoiced / pending invoice / vendor unpaid (count + revenue each).

---

## 10. Budget module

Five versions per year: Q0 (Oct), Q0 Update (Dec), Q1 (Mar), Q2 (Jun), Q3 (Sep).  
Roles: CEO (all), COO (existing clients), Head of Sales (targets + blue sky), CFO (settings), others view-only.  
Features: actualize, GP dual-entry (% or $), version comparison, month drill-down, fiscal year close.

---

## 11. Team targets & bonus

Tabs: Targets · Allocation · Scorecards · Bonus Setup · Calculate.  
Methods: A (% revenue) · B (salary multiplier). KPI: revenue / GP% / weighted.  
Flow: Calculated → FBP review (adjustable) → CEO → Send to HR.

---

## 12. Reports (10 standard)

1. Revenue by client/month/director  
2. GP by campaign  
3. Team targets vs achievement  
4. Budget vs actual  
5. Invoicing status  
6. Vendor payment status  
7. Bonus calculation history  
8. Creator performance  
9. Pipeline report  
10. Custom report builder  

Role-scoped export; scheduled send; Excel/PDF/CSV.

---

## 13. Enterprise workflow engine (§20)

Multi-step approvals, conditional routing, SLA, escalation, delegation.

| Trigger | Approval |
|---------|----------|
| Campaign value > $50k | Director |
| Margin < 15% | Finance/CFO |
| New influencer vendor | Vendor compliance |
| Client without PO | Finance override |
| Discount > 20% | CEO |

Tables (target): `workflow_rules`, `approval_steps`, `approval_history`, `workflow_actions`, `workflow_templates`.

---

## 14. Campaign lifecycle (15 stages — §29)

Brief Received → Internal Review → Creator Discovery → Client Shortlist → Negotiation → Contract Signed → Content Production → Internal Review → Client Approval → Revision → Publishing → Performance Collection → Billing → Vendor Payment → Closure.

Views: Kanban, timeline/Gantt, calendar, SLA dashboard.

---

## 15. Operational modules (Phase 2+)

- **Notifications** — in-app, email, Slack; preferences; SLA escalations  
- **Tasks & deliverables** — linked to campaign/line; revision history  
- **Content assets** — versioning, usage rights, approvals  
- **Contracts** — MSA, SOW, influencer/agency/NDA; e-sign; expiry  
- **Creator portal** — own campaigns, deliverables, contracts, payments (no internal financials)  
- **Client portal** — own brands, approvals, invoices, PO upload  
- **Financial controls** — margin thresholds, revenue recognition, FX, multi-entity, VAT/WHT  
- **AI layer** (Phase 3) — forecasting, pricing, fraud, recommendations, finance insights  

---

## 16. Development roadmap

| Phase | Focus |
|-------|--------|
| **1 — Core operations** | Campaigns, client onboarding, billing, reporting, bonus, access rights |
| **2 — Operational excellence** | Workflow, tasks, notifications, assets, creator portal, contracts |
| **3 — AI expansion** | Forecasting, pricing, fraud, finance insights, recommendations |
| **4 — Enterprise scale** | Client portal, native mobile, data warehouse, advanced BI |

---

## 17. Open questions (from reference §19)

- Account Director on header only vs line only vs both  
- Budget default version on load  
- External onboarding link delivery (email vs copy URL)  
- VR% approval step vs direct edit  
- Discovery tool API keys (Modash etc.)

---

*End of canonical reference. For implementation status vs this spec, see `ARCHITECTURE_ALIGNMENT.md`.*
