# Thinkway Platform — Client Presentation Guide

**Purpose:** Source material for sales, onboarding, and executive client presentations.  
**Audience:** Brand marketers, procurement, finance, agency partners, and C-suite sponsors.  
**Product:** Thinkway · Prefix **TW** · Primary brand colour **#1D9E75**  
**Live environments:** Development `dev.thinkwaymedia.com` · Production `app.thinkwaymedia.com`

---

## Slide 1 — Title & positioning

**Headline:** Thinkway — The Enterprise Campaign Operating System for Influencer Marketing

**One sentence:** Thinkway is a campaign-centric enterprise platform that connects planning, creator discovery, commercial approval, execution, performance, finance, and client collaboration on **one campaign lifecycle** — so brands and agencies run influencer campaigns with the same rigour as traditional media buying.

**What we are not:** A spreadsheet replacement, a creator search tool alone, or a reporting dashboard bolted onto email workflows.

**What we are:** An operational command centre where every stakeholder — your team, Thinkway, creators, and finance — works on the **same campaign object** from brief to closure.

---

## Slide 2 — The problem we solve

| Pain today | Thinkway answer |
|---|---|
| Planning lives in decks; execution lives in WhatsApp and spreadsheets | One campaign spine from strategy → assignments → live posts → billing |
| Creator selection lacks evidence and audit trail | Enterprise Creator Intelligence + frozen client review packages |
| Clients cannot see progress without chasing account teams | Client Workspace and Client Portal with approvals, performance, and documents |
| Finance and ops disagree on PO, invoice, and margin status | Line-level economics, Vendor IO / Client IO, billing queue, collections |
| Performance reports are manual and inconsistent | Branded Combined and Influencer performance reports (HTML / PDF / PPTX / Excel) |
| No single view of “what happens next” on a campaign | Campaign Workspace Lifecycle OS with Decision Center and next-action guidance |

---

## Slide 3 — Platform identity

| Item | Detail |
|---|---|
| Product name | **Thinkway** |
| Campaign numbering | Header `TW-YYYY-NNNN` · Lines `{header}-A`, `-B`, `-C` |
| Hierarchy | Group → Legal Entity → Brand → Campaign → Campaign Line |
| Brand-first | Selecting a brand auto-fills legal entity, category, currency, and commercial terms |
| Stack | Modern cloud SaaS — Next.js, Supabase, enterprise security (RLS, role-based access) |
| Currency display | ISO codes everywhere (e.g. **EGP 1,235,561.00**) — no ambiguous symbols |

---

## Slide 4 — Core philosophy

> **One campaign. One lifecycle. Every stakeholder enters at a different stage — but nobody works in a silo.**

Thinkway is designed as an **enterprise operating system**, not a collection of disconnected modules:

- **Internal teams** plan, discover, assign, and operate campaigns.
- **Clients** review creators, approve plans, track live content, and settle invoices.
- **Creators / vendors** receive IOs, upload deliverables, and track payments.
- **Finance** manages billing, statements, collections, and profitability.
- **Executives** get Decision Center briefings, KPI strips, and boardroom-ready exports.

---

## Slide 5 — End-to-end campaign lifecycle (client view)

Thinkway maps every feature to a **single campaign journey**:

```
Campaign Created → Planning → Creator Discovery → Shortlisting → Media Planning
→ Commercial Approval → Assignments → Client Review → Client Approval
→ Vendor Engagement → Vendor Approval → Deliverables → Publications
→ Performance Monitoring → Finance → Billing → Collections → Reporting → Complete
```

**Client-facing stages (what your client sees and does):**

| Stage | Client experience |
|---|---|
| Planning / Discovery | Optional visibility into strategy progress; premium clients may get Discovery or Studio view access |
| Shortlist / Proposal | Review creator slate — profile, audience, content examples, commercial summary |
| Client Review & Approval | Formal approve / reject / request changes on creators and commercial package |
| Client IO | Review and approve insertion order / commercial terms |
| Deliverables & Publications | Track content production, approve drafts, see live posts |
| Performance | Campaign dashboards + downloadable performance reports |
| Finance | Invoices, statements, payment status, outstanding balance |

---

## Slide 6 — Platform modules overview

### Internal operations (Thinkway team)

| Module | What it does |
|---|---|
| **Dashboard** | KPIs, revenue trends, portfolio health — role-scoped |
| **Campaigns** | Campaign Workspace — the operational command centre for every live campaign |
| **Campaign Studio** | Enterprise planning — brief-to-strategy, media plan, proposal, presentation |
| **Discovery** | Creator search, shortlists, campaign match, quotations |
| **Client Master** | Groups, legal entities, brands, documents, onboarding |
| **Vendor Master** | Influencers, agencies, platforms, rates, bank details |
| **Billing & Finance** | Invoices, Client IO, Vendor IO, collections, aging, FX, VAT |
| **Reports** | Revenue, P&L, profitability, statements, VR, daily drill-downs |
| **AI Copilot** | Conversational planning assistant integrated with Campaign Studio |
| **Admin & Settings** | Users, roles, permissions, discovery engine, access control |

### External collaboration (clients & creators)

| Surface | What it does |
|---|---|
| **Client Workspace** | Branded creator review experience — HypeAuditor-style media plan for client decisions |
| **Client Portal** | Campaigns, approvals, Client IO, invoices, publications, reports, notifications |
| **Creator Portal** | Assigned campaigns, deliverables, vendor IOs, publications, payments |
| **One-click IO approval links** | Secure token links for Client IO and Vendor IO approval without full login |

---

## Slide 7 — Campaign Studio (Enterprise Planning)

**Positioning:** Thinkway Studio is the **Enterprise Campaign Planning Platform** — not a campaign builder or creator search tool.

**Mission:** Transform any brief, objective, or planning request into an **explainable, evidence-based, boardroom-ready strategy** in minutes instead of days.

**What Studio delivers:**

| Output | Client value |
|---|---|
| **Campaign strategy & narrative** | Clear objectives, audience logic, and commercial reasoning |
| **Media mix & media plan** | Publishing calendar, creator mix, platform intelligence, weekly objectives |
| **Scenario planning** | Budget cuts, client selections, alternative versions — with decision simulation |
| **Proposal & presentation** | Executive-ready HTML, PDF, and PPTX without manual redesign |
| **Planning Package** | Execution-ready handoff to Campaign Workspace — no rework |

**Studio principles clients should hear:**

- Recommendations are **evidence-based and commercially justified** — not just a creator list.
- Every recommendation is **explainable** — logic, risks, alternatives, expected outcomes.
- Studio **consumes intelligence** (Enterprise Creator Intelligence) — it does not invent parallel scores.
- Clients can receive **approved snapshots only** — they never see internal drafts unless you share them.

---

## Slide 8 — Discovery & creator selection

**Discovery Search**

- Unified creator browse across platforms with filters (platform, followers, engagement, country, category, language).
- Consistent creator cards with metrics, categories, brand safety, and enrichment badges.
- Infinite scroll, saved filters, recent searches, bulk selection.

**Campaign Match**

- Match creators to a campaign brief or intelligence profile.
- Workspace UI aligned with Discovery design standards.

**Shortlists**

- Curate creator slates for client review.
- Export branded decks: **HTML preview, PDF, Word, Excel, CSV, PPTX** (Pitch and Showcase templates).
- Commercial fields per creator: cost, revenue, GP%, deliverables.

**Client Quotations**

- Serial numbering `QT-YYYY-NNNN`.
- Built from shortlists or manual selection.
- Multi-currency with EGP aggregation (USD, AED, SAR, EUR, GBP supported).
- Branded export: preview, PDF, Excel, Word, PPTX.
- Client-portal-ready approval status fields.

**Creator Compare**

- Side-by-side comparison of up to multiple creators for decision meetings.

---

## Slide 9 — Enterprise Creator Intelligence

**Positioning:** Thinkway’s **single source of truth** for creator investment decisions — used in planning, client review, campaign operations, and reporting.

**Six intelligence layers:**

| Layer | Metrics & insights |
|---|---|
| **Historical** | Follower growth, posting frequency, engagement trends over time |
| **Commercial** | CPM, CPE, EMV, ROI, cost per deliverable, pricing and negotiation trends |
| **Category & Brand** | Content mix, behavioural categories, brand mentions, industry affinity |
| **Performance** | Views, reach, engagement stability, campaign delivery reliability |
| **Audience** | Demographics, geography, language, audience quality and fit |
| **Investment** | Weighted 13-dimension investment score with recommendation tier and explainability |

**Every metric includes:**

- Confidence and evidence coverage
- Trend direction and comparison windows
- Formula transparency and data sources
- “Not available” when data is missing — never invented numbers

**Client-safe usage:** Client Workspace freezes intelligence into review snapshots so clients see consistent, point-in-time data during approval.

---

## Slide 10 — Client Workspace (creator review experience)

**What it is:** A dedicated, branded **client-facing presentation and decision layer** — not a second campaign system.

**Entry points (same product, three doors):**

1. Studio → Create Client Review  
2. Shortlist → Create Client Review  
3. Quotation → Create Client Review  

**Client navigation:** Overview · Creators · Content Plan · Commercial · Feedback · Approval

**Creator media plan features (HypeAuditor-class parity):**

| Capability | Detail |
|---|---|
| Campaign summary | Reach, engagements, CPE, CPM, EMV, creator count, activity mix |
| Creator cards | Media-plan cards with progressive disclosure |
| Creator detail | Profile, audience, performance, content feed, fit, commercial |
| Audience | Age, gender, location, interests when verified |
| Performance | Avg likes/comments/views, ER, estimated reach |
| Content feed | Stored publications; clear unavailable states |
| Deliverables | Proposed mix or “to be confirmed” |
| Commercial | Client-facing investment only (quoted revenue) |
| Selection | Accept / reject / in review with multi-select |
| Comments | Per-creator feedback, reject reasons, change requests |
| Approval | Creator-level and campaign-level decisions |
| Versioning | Frozen snapshot — live edits do not mutate a published review |

**Security:** Token-based secure links (`/review/*`) — same trust model as Client IO approval links.

---

## Slide 11 — Campaign Workspace (operations command centre)

**Positioning:** Where Thinkway **executes** the plan after client approval.

**Process rail (how ops navigate a campaign):**

Overview → Planning → Assignments → Client IO → Vendor IO → Deliverables → Performance → Finance → Timeline → Reporting

**Decision Center (executive briefing):**

| Severity | Meaning | Example |
|---|---|---|
| **Business Blocker** | Campaign cannot advance | Client approval pending, PO exceeded |
| **Operational Attention** | Needs follow-up but campaign continues | Vendor IO acknowledgement, overdue deliverable |
| **Optimization Opportunity** | Optional improvement | Enrichment gaps, reporting enhancements |

**Key operational capabilities:**

- **Assignments** — campaign lines, vendor linkage, PO economics  
- **Client IO** — commercial package for client signature/approval  
- **Vendor IO** — influencer/agency insertion orders with revision history  
- **Deliverables** — content production tracking and documentation  
- **Publications** — live post registry with metrics collection  
- **Performance** — grid view, media drawer, screenshot capture, benchmarks  
- **Finance tab** — revenue, cost, GP, margin, billing readiness  
- **Timeline** — full audit trail of campaign events  
- **Bulk operations** — multi-select actions across registers (enterprise scale)

---

## Slide 12 — Documents & branded exports

Thinkway generates **client-ready documents** from live campaign data — not copy-pasted templates.

| Document | Formats | Use case |
|---|---|---|
| Shortlist deck | HTML, PDF, PPTX, Word, Excel, CSV | Creator pitch / showcase |
| Client quotation | HTML, PDF, Excel, Word, PPTX | Commercial proposal |
| Media plan | HTML, PDF, PPTX | Publishing calendar, creator mix, objectives |
| Studio proposal / presentation | HTML, PDF, PPTX | Boardroom strategy delivery |
| Client IO / Vendor IO | HTML, PDF | Legal/commercial approval |
| Invoice | HTML, PDF | Billing |
| Campaign performance — Combined | HTML, PDF, PPTX, Excel | Full campaign results |
| Campaign performance — Influencer | HTML, PDF, PPTX, Excel | Per-creator performance pack |
| Financial reports | PDF, Excel | P&L, statements, profitability, VR, aging |

**Performance report highlights (Combined):**

- Branded cover with platform badges and QR to campaign dashboard  
- Campaign highlights (top creator, best post, highest ER)  
- Benchmark tables and recommendations  
- Platform breakdown with charts and publication gallery  
- Professional closing page with confidentiality footer  

**Performance report highlights (Influencer):**

- Per-creator page with avatar, KPIs, and publication cards  
- Performance charts, insights, audience snapshot  
- Publication screenshots and metrics  

---

## Slide 13 — Finance & billing

**Line-level economics:** Revenue, cost, gross profit, and margin tracked at campaign line level; aggregated to header, brand, and group.

**Billing workflow:**

| Step | Detail |
|---|---|
| Vendor IO generated | From assignment lines, grouped by influencer |
| Operational status | Tracks IO lifecycle through delivery and invoicing |
| Invoice queue | Campaign billing tab for finance operations |
| Client invoicing | Invoice generation with document preview and PDF |
| Collections | Aging, statements, unsettled reports, payment allocation |
| Multi-currency | Exchange rates, EGP reporting, dual-currency display |

**Finance modules clients’ finance teams care about:**

- Client statements and unsettled balance reports  
- Invoice list with download  
- Credit notes, debit notes, VAT, PO tracker  
- Client profitability and revenue-by-function reporting  

**Financial display standard:** All monetary values use ISO currency codes for clarity in multi-market operations.

---

## Slide 14 — Client Portal (operational self-service)

**Who it’s for:** Client users invited per legal entity with view or approve roles.

**Modules available today:**

| Module | Client can… |
|---|---|
| Dashboard | See pending actions and campaign summary |
| Campaigns | View assigned campaigns and progress |
| Approvals | Action pending approval items |
| Client IO | Review and approve insertion orders |
| Invoices | View and download invoices |
| Publications | See live content and campaign posts |
| Reports | Access shared performance and campaign reports |
| Notifications | Receive in-app alerts |
| Media plan | View campaign media plan (where shared) |

**Access model:** Scoped to the client’s legal entity — clients never see other clients’ data. Role-based: view vs approve.

---

## Slide 15 — Creator Portal

**Who it’s for:** Influencers and vendor partners assigned to campaigns.

| Module | Creator can… |
|---|---|
| Campaigns | See assigned campaigns and details |
| Deliverables | Upload content, track revision status |
| Vendor IO | View and accept insertion order terms |
| Publications | Submit live post URLs |
| Calendar | See publishing schedule |
| Payments | Track payment status |
| Profile | Maintain platform and contact details |
| Notifications | Receive assignment and approval alerts |

**Boundary:** Creators do **not** see internal Thinkway financials, margins, or other clients’ data.

---

## Slide 16 — AI & automation

**AI Copilot (shipped):**

- Conversational interface integrated with Campaign Studio  
- Helps set timelines, objectives, and planning parameters  
- Regenerates strategy sections with guardrails against duplicate requests  
- Friendly rate-limit messaging for enterprise usage  

**AI-ready intelligence (hooks today, automation tomorrow):**

- Enterprise Creator Intelligence exposes AI hints on every layer  
- Change Impact Engine provides structured context for future automation  
- Decision simulation in Studio (budget scenarios, client selection scenarios)  

**Principle for clients:** AI **assists** planning and surfaces evidence — human approval remains the gate for client-facing decisions.

---

## Slide 17 — Security & enterprise readiness

**Messages clients and procurement will expect:**

| Topic | Thinkway approach |
|---|---|
| Data isolation | Row-level security (RLS) per client, campaign, and role |
| Portal isolation | Client and creator portals cannot access internal finance, ops, or other tenants |
| Authentication | Supabase Auth with MFA support, session hardening |
| Approvals | Immutable audit trail; token-based IO approval links |
| Workspace classification | Every route classified — internal vs client vs creator vs admin |
| Environments | Separate Development and Production deployments and databases |
| Operations Center | Internal health dashboard for deployment verification |

**Honest positioning:** Platform has completed extensive security hardening and internal pilot validation. External client portal security review is part of the enterprise rollout checklist.

---

## Slide 18 — Roles & governance (internal + client)

**Thinkway internal roles:**

| Role | Typical scope |
|---|---|
| Admin | Full platform access, users, categories, audit |
| Director | Team oversight, client approval, campaign lock/delete |
| Manager | Campaign and client management, view all campaigns |
| Account Manager | Own campaigns, financials on assigned accounts |
| Finance | Billing full access, view campaigns and reports |
| Data Entry | Limited entry scope, no financial visiblity |

**Client roles (today):** View · Approve (per legal entity)

**Future (Thinkway 3.0 design):** Modular RBAC — Marketing Director, Brand Manager, Procurement, Finance, Legal — with per-module capabilities (comment, download, approve, Discovery search, Studio view).

---

## Slide 19 — Value proposition by stakeholder

### Brand Marketing Director
- Faster, evidence-based creator selection  
- Branded review experience with clear approve/reject workflow  
- Boardroom-ready proposals and performance reports  
- Visibility from plan → live → results without email chains  

### Procurement / Finance
- Formal Client IO and invoice trail  
- Line-level PO and margin tracking  
- Statements, aging, and unsettled balance reports  
- Multi-currency with EGP consolidation  

### Agency / Holding group
- One platform across multiple brands and legal entities  
- Group → Legal Entity → Brand hierarchy  
- Consistent campaign numbering and audit trail  

### C-suite / Executive sponsor
- Decision Center briefing — what blocks progress, what doesn’t  
- Portfolio KPIs and profitability reports  
- Enterprise architecture designed for scale, not spreadsheets  

### Thinkway operations team
- Single campaign workspace replaces fragmented tools  
- Bulk operations for enterprise-scale campaigns (100+ creators)  
- Document lifecycle and change impact engines reduce rework  

---

## Slide 20 — Competitive differentiation

| Typical market tools | Thinkway |
|---|---|
| Creator search platforms | Search **plus** full campaign execution, finance, and client collaboration |
| Project management tools | **Campaign-native** lifecycle — not generic tasks |
| Manual deck-based planning | **Studio** with intelligence-backed recommendations and instant exports |
| Client approval via email/PDF | **Client Workspace** with frozen snapshots, comments, and structured decisions |
| Performance tools disconnected from finance | **One campaign object** from PO to invoice to performance report |
| Spreadsheets for margin tracking | **Line-level economics** with automatic GP/margin calculation |

---

## Slide 21 — Recommended live demo script (45–60 min)

**Environment:** Production `app.thinkwaymedia.com` (or Development for preview features)

1. **Login & dashboard** — show role-based navigation and environment clarity  
2. **Discovery Search** — find creators, open profile sheet, add to shortlist  
3. **Shortlist** — open preview, switch Pitch/Showcase template, download PDF or PPTX  
4. **Quotation** — show commercial engine (cost/GP/revenue), export PDF + Excel  
5. **Campaign Studio** — upload brief or open planning session, show media plan sections (publishing calendar, creator mix)  
6. **AI Copilot** — set campaign timeline, show planning assistance  
7. **Client Workspace** — open a client review link; walk through Creators → Commercial → Approval  
8. **Campaign Workspace** — show Decision Center, Client IO, Vendor IO, Deliverables  
9. **Performance** — live grid, export Combined performance report (PDF/PPTX)  
10. **Finance** — invoice preview, Client IO PDF, statement report  
11. **Client Portal** (if demo user available) — show client view of campaigns and invoices  

**Demo readiness score (internal):** ~86/100 — strong for guided demos; note Media Plan Word export and some Studio output types are not yet available.

---

## Slide 22 — Roadmap honesty (set expectations)

### Shipped and demo-ready
- Discovery, shortlists, quotations, Campaign Studio, AI Copilot  
- Client Workspace creator review  
- Campaign Workspace Lifecycle OS  
- Client IO, Vendor IO, invoices, performance reports  
- Client Portal and Creator Portal (core modules)  
- Enterprise Creator Intelligence (platform SSOT)  
- Branded exports across major document types  

### In progress / planned (do not over-promise)
- **Thinkway 3.0 External Collaboration Platform** — modular client RBAC, automated collections email, organization workspaces  
- **Reporting Hub** — expanded standard report catalogue in-app  
- **Notifications centre** — enterprise alert orchestration  
- **Budget module** — five annual versions with version comparison  
- **Team targets & bonus** — CM scorecards and bonus calculation  
- **Full workflow rule engine** — conditional approvals (>$50k, margin thresholds)  
- **Native mobile app** — Phase 4  
- **Some Studio exports** — Word for media plan; additional catalog output types marked “Soon”  

**Rule for presenters:** Lead with what is live in Production. Position roadmap items as “enterprise programme in flight,” not as today’s checkbox.

---

## Slide 23 — Implementation & onboarding (for enterprise clients)

**Typical rollout phases:**

| Phase | Focus |
|---|---|
| **1 — Foundation** | Legal entities, brands, users, roles, vendor master, VR% and categories |
| **2 — First campaigns** | Pilot campaigns end-to-end: plan → assign → publish → report |
| **3 — Client collaboration** | Client Portal users, Client Workspace reviews, IO approval flows |
| **4 — Finance integration** | Billing rhythm, statements, collections, profitability reporting |
| **5 — Scale** | Bulk operations, portfolio reporting, optional Discovery/Studio client access |

**Data hierarchy setup (required):**

```
Group → Legal Entity (client) → Brand(s) → Campaign → Campaign Line
```

**Brand-first rule:** Every campaign is created from a brand — commercial terms inherit automatically.

---

## Slide 24 — FAQ — hard questions from clients

**Q: Is this just another creator database?**  
A: No. Discovery is one module. The platform owns the full lifecycle: planning, approval, IO, deliverables, live posts, performance, billing, and client collaboration.

**Q: Can we approve creators without email decks?**  
A: Yes. Client Workspace provides a structured review with accept/reject, comments, commercial summary, and frozen version history.

**Q: Do you show our internal margins to clients?**  
A: No. Client-facing surfaces show client investment and quoted revenue — not internal cost or GP unless you explicitly configure otherwise.

**Q: Can finance get statements and aging?**  
A: Yes. Statements, unsettled reports, invoice documents, and collections workspace are built on the same invoice engine — not a duplicate.

**Q: What formats can we export for steering committees?**  
A: PDF and PPTX for proposals, shortlists, media plans, and performance reports; Excel for quotations and financial reports.

**Q: How do you handle multi-brand holding groups?**  
A: Group → multiple legal entities → multiple brands, each with own commercial terms, campaigns, and scoped portal access.

**Q: Is AI replacing our strategists?**  
A: No. AI accelerates drafting and surfaces intelligence. Strategic decisions and client approvals remain human-gated.

**Q: Where is data hosted?**  
A: Cloud infrastructure (Supabase PostgreSQL, Vercel). Separate Development and Production environments with distinct databases.

---

## Slide 25 — Closing & call to action

**Closing line:** Thinkway turns influencer marketing from a fragmented agency workflow into a **campaign-centric enterprise operation** — with the evidence, documents, and financial controls your procurement team expects and the speed your marketing team needs.

**Suggested next steps for prospects:**

1. **Discovery workshop** — 90 minutes on your category, benchmarks, and pilot brand  
2. **Pilot campaign** — one brand, one campaign, full lifecycle with Thinkway ops support  
3. **Client Workspace preview** — branded review experience with your logo and creator slate  
4. **Security & onboarding pack** — RLS overview, portal access model, implementation timeline  

**Contact placeholders:** [Insert Thinkway commercial contact · Insert demo scheduling link · Insert MSA/onboarding path]

---

## Appendix A — Glossary (client-safe terminology)

| Term | Meaning |
|---|---|
| Campaign | Level 1 campaign header (`TW-YYYY-NNNN`) |
| Campaign line | Level 2 PO/financial unit (`-A`, `-B`, …) |
| Legal entity | Client company in contract (not “client” alone) |
| Brand | Product brand under a legal entity — campaign lookup key |
| Vendor / Influencer | Creator or agency in vendor master |
| Client IO | Client insertion order — commercial approval document |
| Vendor IO | Influencer/agency insertion order |
| Shortlist | Curated creator slate for review or quotation |
| Quotation | Formal commercial proposal (`QT-YYYY-NNNN`) |
| Planning Package | Studio output handed to execution in Campaign Workspace |
| EMV | Earned Media Value |
| CPM / CPE | Cost per thousand impressions / cost per engagement |

---

## Appendix B — Eight platform modules (reference card)

1. Dashboard  
2. Campaigns  
3. Client Master  
4. Vendor Master  
5. Team & Targets  
6. Billing  
7. Reports  
8. Admin  

*Extended modules in production codebase:* Discovery, Campaign Studio, AI Copilot, Finance, Collections, Intelligence, Operations Center, Client Portal, Creator Portal, Client Workspace.

---

## Appendix C — Source documents (internal)

For presenters updating this deck:

- `docs/THINKWAY_SYSTEM_REFERENCE.md` — product SSOT  
- `docs/architecture/platform-ux/12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md` — lifecycle stages  
- `docs/architecture/STUDIO_CAPABILITY_CONTRACT.md` — Studio positioning  
- `docs/capabilities/CLIENT_WORKSPACE_CAPABILITY_SPEC.md` — client review features  
- `docs/THINKWAY_3_EXTERNAL_COLLABORATION_PLATFORM.md` — future client platform  
- `docs/DEMO_READINESS.md` — demo script and limitations  
- `docs/ARCHITECTURE_ALIGNMENT.md` — honest shipped vs planned gaps  

---

*Document version: 2026-09-01 · Maintained for client-facing presentations. Update after major releases.*
