# Thinkway 3.0 — External Collaboration Platform

**Product architecture redesign — from Client Portal to Enterprise Collaboration Workspace**

Status: Design (approved for phased implementation) · Owner: Product/Architecture · Date: July 2026

---

## How to read this document

Every design element is tagged against the existing codebase so nothing is designed in a vacuum:

- **REUSE** — an existing engine/table/route is the single source of truth; the new platform only orchestrates it.
- **EXTEND** — an existing structure grows new columns/permissions/UI but keeps its contract.
- **NEW** — genuinely net-new (there is no existing equivalent).

### The substrate we build on (verified in code)

| Capability | Where it lives today | Verdict |
|---|---|---|
| External client users | `client_users` (per-client grant, role = `view` \| `approve`), `features/client-access` | EXTEND → RBAC |
| Client portal | `app/(client-portal)` — approvals, campaigns, client-io, invoices, notifications, publications, reports | Superseded by workspaces (kept during migration) |
| Creator portal | `app/(creator-portal)`, `features/portals` (CreatorScope/ClientScope) | EXTEND (future creator phase) |
| RBAC substrate | `roles`, `permissions`, `role_permissions`, `has_permission()` RPC, `requirePermission()`, role-escalation guard migration | REUSE — already the right shape |
| Invoices | `lib/services/billing/invoice-service.ts` (create / regenerate / ungenerate / workspace), `/api/invoices/[id]/document` (PDF) | REUSE — never duplicate |
| Statements | `lib/services/billing/statement-service.ts`, `/api/reports/statements/document`, **unsettled statement** `/api/reports/unsettled/document` | REUSE — the reminder engine's attachment source |
| Payment allocation | `lib/collections/payment-allocation` (`buildAllocationPlan`), allocation UI in `features/collections` | REUSE |
| Aging | `lib/finance/aging` + `lib/collections/aging`, collections workspace KPI strip/alerts | REUSE — drives reminder triggers |
| Credit notes / adjustments / VAT / PO / FX | `features/finance/*` engines + migrations | REUSE |
| Payment terms & credit | `clients.payment_terms` enum, `clients.credit_limit` (+ credit-limit feature) | EXTEND with reminder policy |
| Notifications | `portal_notifications` table + portal notifications page | EXTEND → Notification Center |
| Invites & audit | `user_invites`, `access_logs` tables | EXTEND → onboarding + activity feed |
| Email sending | **None found** (invites go through Supabase auth) | NEW — email service is greenfield |
| Studio / Discovery / Shortlists / DNA / Quotations / IO | Internal modules with export engines (PDF/PPTX/Excel already proven) | REUSE behind permission façades |

---

## 1. Product Vision

**One sentence:** Thinkway 3.0 turns external access from "a website clients can look at" into **the place where the campaign actually happens between Thinkway and its clients** — briefs arrive there, creators are approved there, content is signed off there, invoices are settled there — with Thinkway Admin holding every configuration dial.

**The shift:**

| Portal (today) | Collaboration Platform (3.0) |
|---|---|
| Pages that display data | Workflows that move work forward |
| Binary view/approve | Capability-level RBAC per module per user |
| One org type (client) | Clients, agencies, vendors, partners, creators |
| Static navigation | Admin-composed modular workspaces |
| Read-only finance | Finance collaboration + automated collections |
| Manual onboarding | Self-service registration + admin review queue |
| No communication | Comments, mentions, decision log on every object |
| Emails: none | Branded transactional + collections email system |

**Design principles (non-negotiable):**

1. **Admin composes, code enables.** Every module, permission, reminder cadence, email template, and workspace layout is data, not code. Shipping a new client configuration must never require a deploy.
2. **One source of truth.** External surfaces are *façades over internal engines* — a client's invoice list is `invoice-service` filtered by scope; never a copy.
3. **External users are guests in a scoped universe.** RLS + scope resolution (`features/portals/scope.ts` pattern) guarantee an org can only ever see rows tied to its `client_ids`/`vendor_ids` — permissions decide *what they can do*, scope decides *what exists*.
4. **Workflow objects, not pages.** The atomic units are Campaign, Shortlist, Proposal, Deliverable, Invoice — each with status, participants, comments, and history. Screens are views over these objects.
5. **AI-first, human-approved.** AI drafts (proposals, replacement suggestions, reminder copy, anomaly alerts); humans approve. External users see AI output only where Admin enables it.

---

## 2. Information Architecture

```
Thinkway Platform
├── Internal (dashboard app — unchanged)
│
└── External Collaboration Platform          app/(external)/
    ├── Organization                          NEW: organizations table
    │   ├── type: client | agency | vendor | partner | creator
    │   ├── linked entities: client_ids[] / vendor_ids[] / influencer_ids[]
    │   ├── members (external users, each with a workspace role)
    │   ├── workspace configuration (modules on/off, per-org branding)
    │   └── finance policy (payment terms, reminder schedule, contacts)
    │
    ├── Workspace (one per organization)
    │   ├── Modules (admin-enabled from the Module Registry)
    │   └── Views (Timeline / Kanban / Table over workflow objects)
    │
    └── Workflow Objects (scoped projections of internal entities)
        ├── Campaign        → campaign_headers/lines (scoped)
        ├── Proposal        → campaign_objects approved snapshots
        ├── Shortlist       → discovery shortlists (shared subset)
        ├── Creator Card    → unified creator + DNA (client-safe fields)
        ├── Deliverable     → assignment deliverables
        ├── Publication     → campaign_publications
        ├── Invoice         → invoices (via invoice-service)
        ├── Statement       → statement-service / unsettled document
        └── Thread          → NEW: comments/mentions/decisions
```

**Why "Organization" and not "Client":** today `client_users` binds a person to one client entity. Agencies manage several brands; holding groups span legal entities. An **organization** owns *links* to N internal entities (clients, vendors), and every scope check resolves through those links. This is the single most important structural change; everything else composes on top of it.

### Module Registry (NEW, config-driven)

A `workspace_modules` registry (seeded, extendable) declares every module with its capability set. Admin enables modules per organization and grants capabilities per member. Nothing about visibility is hardcoded.

Modules at launch: `dashboard`, `campaigns`, `shortlists`, `creator-profiles`, `approvals`, `publishing`, `studio`, `discovery`, `reports`, `performance`, `assets`, `documents`, `contracts`, `timeline`, `messages`, `finance-invoices`, `finance-statements`, `finance-payments`, `notifications`, `settings`.

---

## 3. Navigation Structure

**Pattern: workspace shell (Linear/Notion model), not tabs.**

```
┌──────────┬─────────────────────────────────────────────┐
│ Sidebar  │  Command bar (⌘K)         🔔  👤            │
│          ├─────────────────────────────────────────────┤
│ ◆ Logo   │                                             │
│          │   Module canvas                              │
│ Dashboard│   (views: Overview / Timeline / Kanban /     │
│ Campaigns│    Table — per module)                       │
│ Shortlist│                                             │
│ Publish  │                                   ┌────────┐│
│ Finance  │                                   │ Thread ││
│ Reports  │                                   │ panel  ││
│ ──────   │                                   │(slide) ││
│ Settings │                                   └────────┘│
└──────────┴─────────────────────────────────────────────┘
```

- **Sidebar is rendered from the org's enabled modules** — no hardcoded nav. Order and grouping configurable by Admin (with sane defaults per org type).
- **⌘K command bar** searches scoped objects (campaigns, creators, invoices) and actions ("approve pending creators", "download statement").
- **Right-hand thread panel** opens on any object — comments, mentions, decision log — without leaving context (Figma-comment model).
- **Org switcher** (top of sidebar) for users who belong to multiple organizations (agency employees).
- Mobile: sidebar collapses to a bottom bar of the 4 highest-priority enabled modules + "More".

---

## 4. User Journeys

**J1 — Brand Manager approves a creator slate (the money journey):**
Email "Proposal ready" → deep link → Shortlist module → reviews creator cards (DNA, fit, pricing, content examples) → approves 8, rejects 2 with reasons ("competitor conflict", "need Arabic creator") → replacement request auto-opens for Thinkway team → comments on one creator asking about availability → decision log records everything → dashboard shows "2 replacements in progress".

**J2 — Finance Manager settles the quarter:**
Reminder email (collection@) with outstanding statement attached → "View in workspace" → Finance module: aging buckets, invoice list with live status → downloads statement PDF + Excel → pays two invoices → Thinkway allocates payment (existing engine) → reminders for those invoices stop automatically → partial invoice's next reminder shows only the remaining balance.

**J3 — Agency planner works across three brands:**
Org switcher → Brand A workspace (Studio access: view strategy + comment) → comments on budget slide → switches to Brand B (Discovery access) → searches creators, saves 12 to a draft shortlist → submits to Thinkway → notification lands with the Thinkway team.

**J4 — New vendor self-onboards:**
Public link → registers as Vendor → verifies email → company info + trade license + VAT + bank details → submits → Admin review queue → "Need more information" (missing VAT cert) → vendor uploads → approved → workspace auto-created with vendor default template → welcome email.

**J5 — Thinkway Admin composes a premium client:**
Clients master → organization record → enable modules (adds Studio-view + Discovery-search to defaults) → invite Marketing Director (approver template) and Procurement (viewer + finance) → set finance policy: Net 45, reminders 7/3/1 before + 7/15/30 after, escalation at 45, CC cfo@client.com → preview reminder email → done. Zero code.

---

## 5. Role & Permission Matrix (RBAC)

**REUSE the existing substrate** — `roles`, `permissions`, `role_permissions`, `has_permission()` — extended with external scoping. The current `client_users.access_role` (`view`|`approve`) is migrated into this model and retired.

### Model

```
organizations (NEW)
organization_members (NEW)         person ↔ org, workspace_role_id
workspace_roles (NEW)              org-scoped OR global templates
workspace_role_capabilities (NEW)  role → module → capability[]
workspace_module_config (NEW)      org → module → enabled + settings
```

**Capability vocabulary (per module):** `hidden` · `view` · `comment` · `download` · `upload` · `approve` · `edit` · `manage` — plus module-specific capabilities registered by the module (e.g. `discovery.search`, `discovery.save`, `shortlists.create_draft`, `studio.view_strategy`, `finance.view_payments`).

**Resolution order (deny-wins):**
1. Module enabled for the organization? (else hidden for everyone)
2. Role grants capability? (role = template or custom per-org)
3. Per-member override? (Admin can add/remove single capabilities per user)
4. RLS scope: does the row belong to the org's linked entities? (hard boundary — evaluated in the database, mirroring today's portal RLS)

### Seeded role templates (Admin-editable, per org type)

| Template | Dashboard | Campaigns | Shortlists | Studio | Discovery | Publishing | Finance | Documents |
|---|---|---|---|---|---|---|---|---|
| **Org Admin** | manage | view+comment | approve+comment | per-org | per-org | view+comment | view+download | upload+manage |
| **Marketing Director** | view | view+comment | **approve**+comment | view+comment | search+save | approve | — | view+download |
| **Brand Manager** | view | view+comment | comment | view | search | view+comment | — | view |
| **Procurement** | view | view | — | — | — | — | view+download | upload |
| **Finance** | view (finance tiles) | — | — | — | — | — | view+download+payments | view |
| **Legal** | view | view | — | — | — | — | — | view+download+upload |
| **Vendor Ops** (vendor orgs) | view | assigned only | — | — | — | upload deliverables | own invoices | upload |

Examples from the spec, expressed in this model:
- *Discovery:* `hidden` / `view` / `discovery.search` / `discovery.save` / `shortlists.create_draft` — external Discovery is a **read-only façade** over `browseUnifiedCreators` with a client-safe field mask; drafts live in a separate `draft_shortlists` scope and never touch internal data.
- *Studio:* `hidden` / `studio.view_proposal` / `studio.view_strategy` / `download` / `comment` / `approve` — always renders **approved snapshots** (`getApprovedSnapshot`), never live drafts.
- *Finance:* `hidden` / `finance.view_invoices` / `finance.view_statements` / `download` / `finance.view_payments`.

### Guardrails

- External roles can **never** be granted internal permission slugs (enforced by a `scope` column on `permissions`: `internal` | `external`; the escalation-guard pattern already in migrations extends to this).
- Every capability change writes to `access_logs` (existing table).
- Approvals are capability + identity: the decision log records *which member* approved, immutable.

---

## 6. External Workspace Architecture

**Runtime model:**

```
Request → external session → resolve OrganizationScope   (extends features/portals/scope.ts)
        → load workspace config (modules + role capabilities)   [cached per session]
        → render shell (sidebar = enabled modules)
        → module loaders call INTERNAL services with scope filters
        → RLS enforces entity boundary regardless of application code
```

- **One route group** `app/(external)/w/[orgSlug]/...` replaces `(client-portal)` (kept live during migration; both share the scope layer so behavior can't drift).
- **Module = feature folder** under `features/external/<module>/` exporting: capability manifest (registered into the Module Registry), loader (scoped queries), views, and thread bindings. Adding a module = adding a folder + registry row; the shell discovers it.
- **Views are shared primitives:** `TimelineView`, `KanbanView`, `TableView`, `CardGrid` — every module renders its objects through them, which is what makes the product feel like one system.
- **Branding per organization:** logo, accent color (within the design system's constraints), custom workspace name — stored on the organization, applied by the shell.

### Client Workspace (default composition)

Dashboard · Campaigns (timeline/kanban) · Shortlists (approval center) · Publishing calendar · Reports/Performance · Documents & Contracts · Finance (invoices/statements/payments) · Messages · Settings. Premium add-ons: Studio (view/comment/approve on proposals & strategy), Discovery (search/save/draft shortlists).

### Vendor Workspace (default composition)

Dashboard (assigned work + payment status) · My Campaigns (assigned lines only) · Deliverables (upload, revision cycle) · Publishing (submit live URLs) · Finance (own invoices & IO status — reuses vendor IO engine) · Documents (contracts, IOs) · Messages. Vendors see **only assignment-scoped rows** — the vendor IO + assignment engines already carry the keys.

Partner/Agency workspaces are compositions of the same modules with different defaults (agency = client modules across multiple linked clients).

---

## 7–8. Campaign Lifecycle (client-facing)

One lifecycle object drives Timeline and Kanban views — statuses map 1:1 to existing internal state (campaign headers/lines, campaign objects, IO, publications, invoices); **no parallel status store**:

```
Brief → Discovery → Strategy → Proposal → Creator Selection → Approvals
     → Contracts → Production → Publishing → Performance → Finance
```

| Stage | Backed by (existing) | Client sees / does |
|---|---|---|
| Brief | campaign intelligence profile / uploaded brief | submit brief (upload or form), comment |
| Discovery | discovery engine (internal) | progress indicator only (or Discovery module if granted) |
| Strategy | campaign_objects strategy sections | view (if Studio granted), comment |
| Proposal | approved campaign object snapshot + proposal exports (HTML/PDF/PPTX — already built) | view, download, comment, **approve/reject** |
| Creator Selection | shortlists + vendor decisions | approve/reject/replace per creator (Section 10) |
| Contracts | client IO + vendor IO engines | view, download, sign-status |
| Production | assignment deliverables | watch statuses, comment on drafts |
| Publishing | campaign_publications | approve drafts, see schedule + live URLs |
| Performance | performance report engine (PDF/PPTX exists) | dashboards + downloadable report |
| Finance | invoice/statement engines | invoices, balance, payments |

Kanban columns = stages; cards = campaigns; badges = pending-your-action counts. Timeline = the same object on a date axis with milestones (existing timeline data).

---

## 9. Dashboard

Answer-first tiles, each rendered **only if the member can see the underlying module** (tiles are the module's summary contract — a module registers its own tile):

- **Needs your action** (top, always first): pending proposal approvals, creators awaiting decision, drafts awaiting sign-off, documents requested.
- **Campaigns:** active count, stage distribution, next 7 days of publishing.
- **Performance:** reach/engagement summary vs targets (from performance engine).
- **Finance:** outstanding balance, due soon, overdue (from aging engine — same numbers as internal collections, never recomputed).
- **Activity:** recent comments/mentions, decision log entries, uploads.
- **AI panel** (admin-toggleable): "3 creators in your shortlist trend upward this week", "Campaign X is pacing 12% above reach target".

---

## 10. Creator Shortlist & Replacement Workflow

The approval center — the module clients will live in.

**Creator card (client-safe projection):** avatar, name, platforms, followers, ER, audience summary, Creator DNA highlights, AI score + brand fit, brand safety flag, tier, price (if Admin exposes pricing), deliverables, projected reach/impressions/CPM/ROI, previous campaigns with this client, availability, content examples. **Field visibility is a per-org config** (some clients see pricing, some don't) — a field mask in the module config, not a fork of the card.

**Actions:** Approve · Reject (reason required) · Request replacement · Comment/ask (threads on the card) · Compare (side-by-side, up to 4 — reuses the internal compare bundle) · Bookmark · Bulk approve/reject · Download deck (proposal export engine).

**Replacement workflow (NEW state machine on top of existing decisions):**

```
Reject + reason (taxonomy: too expensive · wrong audience · low engagement ·
wrong category · competitor conflict · need female creator · need Arabic creator · other+note)
   → replacement_request (open) → lands in Thinkway inbox
   → team proposes replacement (Draft Studio replace flow — already built)
   → client notified → approve/reject replacement → closes loop
```

Rejection reasons are structured data → they feed relevance scoring and future AI ("this client rejects on price at 2× median") — the taxonomy is a seeded, Admin-editable table.

---

## 11. Discovery Experience (external)

Granted per org. **Read-only façade** over the unified browse engine with: client-safe field mask (no internal notes, costs, margins, contact data), search + filters (platform, followers, ER, country, category, language), save to bookmarks, assemble **draft shortlists** that submit to Thinkway for validation — drafts are a separate table scoped to the org; nothing external ever mutates internal creator data. Rate-limited and audit-logged (`access_logs`).

## 12. Studio Experience (external)

Granted per org, per capability: `view_proposal`, `view_strategy`, `view_concepts`, `view_budget`, `view_audience`, `download`, `comment`, `approve`. Always renders **approved snapshots** through the existing proposal document engine (same CIO/VIO-branded HTML/PDF/PPTX outputs already shipped) — the client sees exactly what Thinkway exported, plus threads anchored to sections. Approve here = campaign object lifecycle transition (existing `transitionLifecycle`).

---

## 13. Finance Experience + Automated Collections

### Finance workspace (REUSE everything)

| Surface | Source of truth (existing) |
|---|---|
| Invoice list + status | `invoice-service` (`Draft/Issued/Partially Paid/Paid` already modeled in portal types) |
| Invoice PDF | `/api/invoices/[id]/document` |
| Outstanding statement | statement-service + `/api/reports/unsettled/document` |
| Payment history & allocation | payment-allocation engine |
| Outstanding balance & aging | `lib/finance/aging` + collections aging |
| Credit notes | adjustments engine |
| Excel exports | existing xlsx export patterns (quotations/invoices) |

The external Finance module adds **zero financial logic** — it is scope-filtered rendering + downloads.

### Automated Collection & Payment Reminder Engine (NEW — orchestration only)

**Per-client policy** (stored on the organization's finance policy; seeded from `clients.payment_terms`):

```
finance_policies (NEW)
  payment_terms (reuse enum) · grace_days · reminder_offsets (e.g. [-7,-3,-1,0,+7,+15,+30,+45,+60])
  frequency_after_60 · escalation_at · escalation_recipients (internal)
  finance_contacts[] · cc[] · bcc[] · template_set · paused (bool)
```

**Engine (a scheduler + one rule):**

```
Daily (and on payment-allocation events):
  for each org with policy:
    balance = aging engine (live)                       ← REUSE
    open invoices = invoice-service (live)              ← REUSE
    for each open invoice: due-date offset matches policy? → enqueue reminder
    fully settled? → no reminders (automatic stop — nothing to match)
    partially paid? → reminder shows remaining balance only (allocation-aware)

  send = compose email (Section 15)
       + attach unsettled statement PDF (generated AT SEND TIME from /api/reports/unsettled/document)
       + attach open invoice PDFs (existing documents)
       + log to reminder_events (NEW: audit, idempotency key = invoice+offset)
```

Invariants: **live status at send time** (a payment allocated 5 minutes before send suppresses/rewrites the reminder), idempotent per invoice+offset, `paused` kill-switch per org, escalation creates an internal task + notifies escalation recipients. Runs in the existing worker service (BullMQ — same infra as enrichment; a `finance-reminders` queue with a daily scheduler).

Every reminder email contains: outstanding balance, invoice table (number, date, due date, remaining), payment instructions, **Download Statement** and **Download Invoice** buttons (signed short-lived URLs), **Contact Finance** button, and a workspace deep link.

---

## 14. Notification Center

**EXTEND `portal_notifications`** into a typed event system:

```
notification_events (extend): org_id · member_id · type · object_ref (module/object/id)
  · title/body · read_at · email_state (none/queued/sent)
```

Types (seed, extensible): proposal_ready, proposal_approved, proposal_rejected, creator_approved, creator_rejected, replacement_requested, replacement_ready, campaign_updated, publishing_scheduled, deliverable_submitted, revision_requested, invoice_issued, invoice_due, invoice_overdue, payment_received, comment_added, mention, document_uploaded, document_requested, campaign_completed.

Delivery: in-app (bell + per-module badges) always; email per **member notification preferences** (immediate / daily digest / off — per category). Finance events always follow the collections policy regardless of personal preferences (business rule).

## Communication layer (threads)

**NEW, one system for everything:**

```
threads: object_ref (any workflow object or section anchor)
messages: thread_id · author (internal or external member) · body (rich) · attachments
mentions: message_id → member/internal user  → notification
decisions: object_ref · actor · action (approved/rejected/replacement_requested)
           · reason · snapshot_ref · created_at   (immutable — the audit trail)
activity_feed = union(messages, decisions, uploads, status transitions) per object/org
```

Threads anchor to: campaign, proposal section, creator card, deliverable, publication, invoice. The thread panel (Section 3) is the single UI. Internal users see threads inside the internal app on the same objects — one conversation, two shells.

---

## 15. Professional Email System (NEW)

There is no email infrastructure today — this is greenfield, built once for the whole platform:

```
lib/email/
  provider.ts        (Resend or SES adapter — one interface, env-selected)
  render/            React Email templates → responsive HTML (Gmail/Outlook/Apple/mobile tested)
  identities.ts      sender registry
  send-service.ts    queue-backed (BullMQ `email` queue), logs to email_events
email_templates (DB) subject/blocks per template key + per-org overrides — Admin-editable
email_events (DB)    to/cc/bcc, template, object refs, provider id, status (sent/bounced/opened)
```

**Sender identities (config, not code):**

| Identity | Address | Used for |
|---|---|---|
| General | `hello@thinkwaymedia.com` (sender + reply-to) | invitations, welcome, verification, password reset, workspace invites, campaign/proposal/discovery/studio notifications |
| Collections | `collection@thinkwaymedia.com` (sender + reply-to) | invoice issued, due/overdue reminders, statements, partial-payment confirmation, payment received, credit notes, monthly statements |

**Template anatomy:** Thinkway logo header · personalized greeting · one clear message · primary CTA button (deep link into workspace) · data block (e.g. invoice table) · footer with company info, contacts, legal disclaimer · consistent typography (system stack + brand accent, CIO/VIO document language — same palette discipline as the proposal exports).

**Collections tone ladder** (template set, Admin-editable): pre-due = friendly heads-up → due = clear request → +7/+15 = firm professional → +30/+45 = formal with escalation notice → 60+ = final notice referencing next steps. Same layout, progressively firmer copy — never hostile.

**Email administration (Admin UI):** sender/reply-to per category, CC/BCC defaults, signature, branding, template editor with live preview + test-send, reminder schedule editor, escalation rules. No deploy for any of it.

---

## 16. Client & Vendor Onboarding

### Self-service registration (NEW)

Public route `/register` (link shareable; per-type variants `/register/vendor` etc.):

```
Register (email+password, org type) → email verification (hello@)
→ Company profile: name, trade license no., VAT no., tax registration, country,
  address, website, industry, contacts (finance/marketing/procurement),
  billing email, PO email, bank details (optional), logo, legal docs (upload)
→ Submit → status: pending
→ Admin Review Queue: pending / under_review / need_more_info / approved / rejected
   · request-more-info sends templated email + reopens the form with a checklist
→ Approved → organization created + linked to (new or existing) client/vendor record
   → workspace composed from the org-type default template → welcome email
```

- Accounts **never activate automatically** — approval is the only path to a workspace.
- Registrations live in `onboarding_applications` (NEW) with document storage under the documents engine; approval writes into the existing masters (`clients` / vendors) so finance/ops see the same records they do today.
- Duplicate detection against existing clients/vendors (name/VAT/domain) surfaces in the review queue.

### Manual registration (kept)

The current admin flows remain: create clients, vendors, partners, employees, creators, and invite users directly (`user_invites`). Manual creation of an organization + invited members is the same machinery as approval — one code path.

---

## 17. Dashboard Wireframes (structure, not pixels)

```
┌ Needs your action ───────────────────────────────────────────┐
│ [3 creators await approval] [1 proposal ready] [2 drafts]    │
├───────────────┬───────────────────┬──────────────────────────┤
│ Campaigns     │ Publishing next 7d│ Finance                  │
│ 4 active      │ Tue: @salma TikTok│ Outstanding: EGP 840,000 │
│ ▓▓▓░ stages   │ Thu: @omar reel   │ Due soon: 2 · Overdue: 1 │
├───────────────┴───────────────────┴──────────────────────────┤
│ Performance snapshot (reach vs target sparkline, ER, top post)│
├───────────────────────────────┬──────────────────────────────┤
│ Activity (comments, decisions)│ AI insights (if enabled)     │
└───────────────────────────────┴──────────────────────────────┘
```

Every tile deep-links into its module pre-filtered to the referenced objects. Tiles collapse to a single column on mobile, "Needs your action" always first.

## 18. High-Fidelity UI Direction

- **Same design language as the internal platform** (shadcn/ui + Tailwind + the established green `#1D9E75` accent discipline), tuned to feel calmer: more whitespace, larger type on dashboards, document-grade typography on proposals.
- Cards and tables come from the shared view primitives — external and internal stay visually coherent because they share components, not because designers keep them in sync.
- Dark/light from day one (already the house standard).
- Org accent color allowed only on identity elements (avatar ring, sidebar header) — never on semantic colors (status, finance states).

## 19. Mobile Responsive Experience

- Shell: bottom nav (4 modules + More), thread panel becomes full-screen sheet, tables become card lists (the portal components already follow this pattern).
- Approval flows are mobile-first: swipe-able creator cards (approve/reject), one-thumb reasons sheet.
- Finance: statement/invoice downloads hand off to native viewers.
- Publishing calendar collapses to agenda list.
- Push = email deep links (no native app in scope; PWA-ready shell).

## 20. Design System

- **Colors:** existing palette — ink `#1A1F36`, navy `#0A0F1E`, accent green `#1D9E75` (single accent rule), semantic set (success/warning/destructive from shadcn tokens), validated tier palette for creator data (already CVD-checked: amber/indigo/green/violet/sky).
- **Typography:** Inter (UI), document serif optional for proposal surfaces; scale 12/14/16/20/24/32.
- **Spacing:** 4-pt grid; cards `p-4`/`p-5`; section gap 12/16/20.
- **Components:** extend the existing shadcn component set with: WorkspaceShell, ModuleSidebar, CommandBar, ThreadPanel, DecisionLog, CreatorCard (external), ApprovalBar, KanbanBoard, TimelineRail, FinanceTable, StatCard, EmptyState, PermissionGate.
- **Icons:** lucide (already standard).
- All new components live in shared `components/` so internal surfaces can adopt them — one system.

---

## 21. Roadmap & Scalability

**Phase 1 — Foundation (unlocks everything):** organizations + members + workspace RBAC (extending existing roles/permissions), workspace shell + module registry, migrate `(client-portal)` pages into modules (campaigns, approvals, publishing, invoices, reports) behind the new permission model. `client_users` rows migrate: `view` → Viewer template, `approve` → Marketing Director template.

**Phase 2 — Collaboration:** threads/mentions/decision log + notification center v2 + email system (identities, templates, admin UI). Highest perceived-value phase.

**Phase 3 — Finance automation:** finance policies, reminder engine (worker queue), collections template ladder, escalation. (Depends on Phase 2's email system.)

**Phase 4 — Premium access:** external Studio (snapshot + threads + approve), external Discovery (façade + draft shortlists), replacement workflow wired into Draft Studio.

**Phase 5 — Onboarding:** public registration, review queue, auto-workspace composition.

**Phase 6 — Creators & beyond:** creator workspace (extends creator portal into the same shell), partner analytics, API access for enterprise clients, webhooks, SSO (SAML/OIDC) for enterprise orgs, per-org data residency if required.

**Scalability positions:** module registry means new modules ship without touching the shell; capability vocabulary means new permissions without schema changes; email templates in DB mean copy changes without deploys; every external read is a scoped view over internal engines, so internal refactors don't fork.

---

## Challenging the current architecture (what we change and why)

1. **Kill the binary view/approve role.** It cannot express "Procurement sees finance but not campaigns". The RBAC substrate already exists internally — extending it to external users is cheaper than maintaining a second model. (`client_users` becomes a legacy shim during migration.)
2. **Kill per-audience route groups as the composition mechanism.** `(client-portal)` / `(creator-portal)` hardcode navigation per audience. One external shell + module registry serves all org types, and Admin composes — this is the difference between "portal" and "platform".
3. **Promote the client from spectator to participant.** Today the portal displays outcomes. The redesign moves the *decision moments* (creator approval, proposal sign-off, draft approval, replacement) into the workspace with an immutable decision log — that is where the collaboration value and the audit value live.
4. **Approvals as data, not emails.** Today approval evidence is scattered. The decisions table becomes the contract-grade record (who/when/what snapshot) — legal-grade traceability that also feeds AI.
5. **One thread system everywhere** instead of per-feature comments later: retrofitting communication is the most expensive mistake enterprise SaaS makes; build it once in Phase 2 and every subsequent module inherits it.
6. **Collections as orchestration, never logic.** The temptation will be to compute balances in the reminder engine "just for the email". Refuse it — the engine only *asks* the aging/statement/invoice engines and *schedules sends*. This single rule keeps finance correct forever.
7. **Field masks over forks.** Client-safe creator cards, snapshot-only Studio, façade Discovery — every external surface is the internal engine plus a mask, so there is exactly one implementation of every business rule.
8. **Registration feeds the masters.** Self-service onboarding writes into the existing `clients`/vendor records on approval — no shadow CRM.

---

*End of design. Implementation follows the standing protocol: each phase begins with an evidence-based increment plan for approval, built on `claude/thinkway-3`.*
