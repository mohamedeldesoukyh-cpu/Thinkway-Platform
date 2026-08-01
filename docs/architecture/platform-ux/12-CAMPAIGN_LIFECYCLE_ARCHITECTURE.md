# 12 — Campaign Lifecycle Architecture

**Status:** Draft for final Product approval — then **FROZEN** as highest-level business process SSOT  
**Authority:** Supersedes stage naming in docs 03/06 where they conflict; those docs defer to this lifecycle  
**Related:** [`11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md`](./11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md) · [`01-PLATFORM_UX_ARCHITECTURE.md`](./01-PLATFORM_UX_ARCHITECTURE.md)  
**Constraints:** Architecture only — no API · DB · workflow engine · calculation changes until Phase 1 is authorized

---

## 0. Platform principle (canonical)

> **Thinkway is not a collection of pages, modules, or portals. It is a campaign-centric enterprise operating system. Every participant—internal teams, clients, vendors, creators, finance, executives, and AI—works on the same campaign through a stakeholder journey that enters the campaign lifecycle at different stages. Navigation, workspaces, approvals, documents, reporting, and collaboration must always reinforce the campaign lifecycle rather than independent applications or disconnected pages.**

---

## 1. Purpose

This document defines the **one canonical Campaign Lifecycle Architecture**.

It is the backbone of the Thinkway platform.

| Rule | Meaning |
|------|---------|
| Campaign-specific | The lifecycle belongs to the campaign, not to a role |
| Universal spine | Every stakeholder journey **extends** this lifecycle |
| Exhaustive mapping | Every future feature maps into one or more stages |
| Nothing outside | No product surface may exist outside the campaign lifecycle narrative |
| Navigation teaches state | Business Process Navigation communicates stage, completion, blockage, waiting, and next action |

After Product approval of this document:

- Platform UX Architecture → **frozen**  
- Business Process Architecture → **frozen**  
- Stakeholder Journey Architecture → **frozen**  
- Campaign Lifecycle Architecture → **frozen**  

Then Phase 1 implementation may be authorized.

---

## 2. Canonical Campaign Lifecycle

```
Campaign Created
        ↓
Planning
        ↓
Creator Discovery
        ↓
Shortlisting
        ↓
Media Planning
        ↓
Commercial Approval
        ↓
Assignments
        ↓
Client Review
        ↓
Client Approval
        ↓
Vendor Engagement
        ↓
Vendor Approval
        ↓
Deliverables
        ↓
Publications
        ↓
Performance Monitoring
        ↓
Finance
        ↓
Billing
        ↓
Collections
        ↓
Reporting
        ↓
Campaign Complete
```

### Stage index

| ID | Stage | Intent (one line) |
|----|-------|-------------------|
| S00 | Campaign Created | Header exists; commercial skeleton established |
| S01 | Planning | Strategy, brief, window, objectives |
| S02 | Creator Discovery | Find candidate creators |
| S03 | Shortlisting | Curate and shortlist creators |
| S04 | Media Planning | Schedule / plan content across the window |
| S05 | Commercial Approval | Quotation / commercial terms locked for progression |
| S06 | Assignments | Lines, economics, creator linkage |
| S07 | Client Review | Client reviews plan / creators / commercial package |
| S08 | Client Approval | Client formally approves (e.g. Client IO / plan) |
| S09 | Vendor Engagement | Vendor IOs issued / sent |
| S10 | Vendor Approval | Vendor / creator accepts IO terms |
| S11 | Deliverables | Content production & documentation |
| S12 | Publications | Content goes live |
| S13 | Performance Monitoring | Metrics, health, optimization cues |
| S14 | Finance | Revenue/cost/GP command; readiness to bill |
| S15 | Billing | Invoices generated / approved / posted |
| S16 | Collections | Cash recovery / outstanding AR |
| S17 | Reporting | Close-out narratives and exports |
| S18 | Campaign Complete | Terminal operational state |

### Practical process rail (workspace navigation)

Day-to-day Business Process Navigation may **cluster** stages for density, but every cluster maps 1:N to the canonical list:

| Rail item | Canonical stages covered |
|-----------|--------------------------|
| Overview | S00–S01 (+ health across spine) |
| Planning | S01–S05 (Discovery/Shortlist/Media Plan/Commercial cues) |
| Assignments | S06 |
| Client IO | S07–S08 |
| Vendor IO | S09–S10 |
| Deliverables | S11 |
| Performance | S12–S13 |
| Finance | S14–S16 |
| Timeline | Cross-cutting history (all stages) |
| Reporting | S17 (link / hub) |

Clustering is a **presentation choice**. The canonical lifecycle remains the SSOT for mapping features.

---

## 3. Lifecycle state model (navigation education)

Business Process Navigation must communicate more than order:

| Nav signal | Meaning |
|------------|---------|
| **Current stage** | Where operational focus is |
| **Completed stages** | Exit criteria met (heuristic from existing data initially) |
| **Upcoming stages** | Not yet active |
| **Blocked stages** | Cannot progress (missing prerequisite / policy) |
| **Waiting for external party** | Client / vendor / creator action pending |
| **Waiting for approval** | Approval object in flight |
| **Recommended next action** | Single primary CTA for the acting stakeholder |

Navigation itself educates users on the campaign’s operational state.

---

## 4. Lifecycle Mapping Matrix

Legend for stakeholder columns: **P** = Primary owner · **S** = Supporting · **V** = Visibility · **E** = Edit · **A** = Approve · **M** = Monitor only · **—** = out of journey for that stage (normally)

### 4.1 Stakeholder role by stage

| Lifecycle Stage | Internal Ops | Commercial | Client | Vendor | Creator | Finance | Executive | AI |
|-----------------|:------------:|:----------:|:------:|:------:|:-------:|:-------:|:---------:|:--:|
| Campaign Created | P | S | — | — | — | M | M | S |
| Planning | P | S | V | — | — | — | M | S |
| Creator Discovery | P | S | V | — | — | — | M | S |
| Shortlisting | P | S | V/A* | — | — | — | M | S |
| Media Planning | P | S | V/A* | — | — | — | M | S |
| Commercial Approval | S | P | A | — | — | M | M | S |
| Assignments | P | S | V | V | V | M | M | S |
| Client Review | S | P | P | — | — | — | M | S |
| Client Approval | S | S | P/A | — | — | M | M | S |
| Vendor Engagement | P | S | M | P | V | M | M | S |
| Vendor Approval | S | S | M | P/A | A* | M | M | S |
| Deliverables | P | S | V/A* | S | P | — | M | S |
| Publications | P | S | V | S | P | — | M | S |
| Performance Monitoring | P | S | V | V | V | M | P/M | S |
| Finance | S | S | M | M | M | P | M | S |
| Billing | S | S | V | — | — | P | M | S |
| Collections | S | S | V | — | — | P | M | S |
| Reporting | S | S | V | V | V | S | P | S |
| Campaign Complete | P | S | V | V | V | S | M | S |

\*Client/creator approve only where product rules already allow (e.g. Client IO approve, content approval, creator accept IO).

### 4.2 Stage blueprint (owner · actions · I/O · transitions · surfaces)

For each stage: **Primary owner**, **Supporting**, **Actions**, **Inputs**, **Outputs**, **Status transitions (UX)**, **Workspaces**, **Documents**, **Notifications**, **Timeline events**.

#### S00 — Campaign Created

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops |
| Supporting | Commercial, Executive (monitor) |
| Actions | Create/edit header; set brand/window/currency; open Planning |
| Inputs | Brand, legal entity, brief, dates, budget/PO cues |
| Outputs | Campaign header (TW-…) |
| Status transitions | Draft / Active planning |
| Workspaces | Overview |
| Documents | Brief (optional) |
| Notifications | Campaign created (internal) |
| Timeline | Campaign created |

#### S01 — Planning

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops |
| Supporting | Commercial, AI |
| Actions | Define objectives; refine brief; open Discovery / Studio |
| Inputs | Header, brief, window |
| Outputs | Planning package readiness |
| Status transitions | Planning in progress → ready for discovery |
| Workspaces | Overview, Planning cluster, Studio |
| Documents | Brief, strategy notes |
| Notifications | Planning assigned / updated |
| Timeline | Planning started / updated |

#### S02 — Creator Discovery

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops |
| Supporting | Commercial, AI, Client (visibility) |
| Actions | Search, filter, compare, add to shortlist |
| Inputs | Criteria, brand fit, campaign context |
| Outputs | Candidate set |
| Status transitions | Discovery open → candidates ready |
| Workspaces | Discovery (campaign-contextual), Planning |
| Documents | — |
| Notifications | Shortlist candidates available |
| Timeline | Discovery activity |

#### S03 — Shortlisting

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops |
| Supporting | Commercial, Client (review/select where enabled), AI |
| Actions | Curate shortlist; client review comments; select |
| Inputs | Candidates |
| Outputs | Approved shortlist |
| Status transitions | Shortlist draft → client reviewed → selected |
| Workspaces | Shortlists, Client Collaboration (review) |
| Documents | Shortlist PDF/export |
| Notifications | Shortlist ready for client |
| Timeline | Shortlist submitted / selected |

#### S04 — Media Planning

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops |
| Supporting | Commercial, Client (review/approve), AI, Planning Board (future) |
| Actions | Build/revise schedule; open Studio; share for review |
| Inputs | Shortlist, window, deliverable types |
| Outputs | Media Plan version |
| Status transitions | Draft → under review → approved |
| Workspaces | Media Plan ops, Studio, Planning Board (2.2a) |
| Documents | Media Plan PDF / portal view |
| Notifications | Plan shared / approved / revise requested |
| Timeline | Media Plan version events |

#### S05 — Commercial Approval

| Field | Definition |
|-------|------------|
| Primary owner | Commercial |
| Supporting | Internal Ops, Client (approve), Finance (monitor) |
| Actions | Finalize quotation/commercial terms; progress to assignments |
| Inputs | Shortlist, pricing, terms |
| Outputs | Commercially approved package |
| Status transitions | Quote draft → sent → approved |
| Workspaces | Quotations, Campaign Planning/Commercial cues |
| Documents | Quotation |
| Notifications | Quote sent / approved |
| Timeline | Commercial approval |

#### S06 — Assignments

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops |
| Supporting | Commercial, Finance (monitor), Creator/Vendor (visibility) |
| Actions | Create/edit lines; link creators; set economics |
| Inputs | Approved commercial package, creators |
| Outputs | Assignment lines |
| Status transitions | Unassigned → assigned → confirmed |
| Workspaces | Assignments |
| Documents | — |
| Notifications | Assignment created / updated |
| Timeline | Assignment events |

#### S07 — Client Review

| Field | Definition |
|-------|------------|
| Primary owner | Client (+ Commercial facilitating) |
| Supporting | Internal Ops, AI |
| Actions | Review creators/plan/package; comment; request changes |
| Inputs | Shortlist / Media Plan / commercial package / Client IO draft |
| Outputs | Review feedback |
| Status transitions | Shared for review → changes requested → ready to approve |
| Workspaces | Client Collaboration Portal, Client IO |
| Documents | Client IO draft, plan preview |
| Notifications | Review requested / comments added |
| Timeline | Client review events |

#### S08 — Client Approval

| Field | Definition |
|-------|------------|
| Primary owner | Client |
| Supporting | Commercial, Internal Ops, Finance (monitor) |
| Actions | Approve Client IO / plan; reject; request revision |
| Inputs | Client IO / approval package |
| Outputs | Approved Client IO (or rejection) |
| Status transitions | Sent → under review → approved / rejected |
| Workspaces | Client IO, Client Portal approvals |
| Documents | Client IO |
| Notifications | Approval / rejection / reminder |
| Timeline | Client IO approved |

#### S09 — Vendor Engagement

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops (+ Vendor as recipient) |
| Supporting | Commercial, Creator (visibility), Finance (monitor) |
| Actions | Generate/send Vendor IOs; track delivery |
| Inputs | Assignments, Client approval |
| Outputs | Vendor IO documents (sent) |
| Status transitions | Draft → generated → sent |
| Workspaces | Vendor IO, Vendor Portal |
| Documents | Vendor IO |
| Notifications | IO sent to vendor/creator |
| Timeline | Vendor IO sent |

#### S10 — Vendor Approval

| Field | Definition |
|-------|------------|
| Primary owner | Vendor / Creator (accept) |
| Supporting | Internal Ops, Commercial, Finance (monitor) |
| Actions | Accept / decline IO; record manual approval |
| Inputs | Vendor IO |
| Outputs | Approved Vendor IO |
| Status transitions | Sent → approved / declined |
| Workspaces | Vendor IO, Creator/Vendor portals |
| Documents | Vendor IO |
| Notifications | IO approved / declined |
| Timeline | Vendor IO approved |

#### S11 — Deliverables

| Field | Definition |
|-------|------------|
| Primary owner | Creator (produce) · Internal Ops (operate) |
| Supporting | Vendor, Client (review/approve where enabled), AI |
| Actions | Upload docs/assets; review; approve content |
| Inputs | Approved Vendor IO, briefs |
| Outputs | Received/approved deliverable units |
| Status transitions | Pending → submitted → approved / missing |
| Workspaces | Deliverables (selection model preserved) |
| Documents | Deliverable assets, captions, versions |
| Notifications | Submission / missing / approved |
| Timeline | Deliverable events |

#### S12 — Publications

| Field | Definition |
|-------|------------|
| Primary owner | Creator · Internal Ops |
| Supporting | Client, Vendor, Executive (monitor) |
| Actions | Mark live; attach publication links; sync |
| Inputs | Approved deliverables, schedule |
| Outputs | Live publications |
| Status transitions | Scheduled → live / posted |
| Workspaces | Performance / Publications |
| Documents | Publication URLs, screenshots |
| Notifications | Went live |
| Timeline | Publication live |

#### S13 — Performance Monitoring

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops · Executive (monitor) |
| Supporting | Client, Commercial, AI |
| Actions | Refresh metrics; review ER/reach; export |
| Inputs | Publications, metrics sync |
| Outputs | Performance summary |
| Status transitions | Collecting → reported |
| Workspaces | Performance |
| Documents | Performance report PDF |
| Notifications | Sync issues / milestones |
| Timeline | Metrics sync / report generated |

#### S14 — Finance

| Field | Definition |
|-------|------------|
| Primary owner | Finance |
| Supporting | Internal Ops, Commercial, Executive |
| Actions | Review R/C/GP/Margin; prepare billable |
| Inputs | Assignments, IO approvals, PO |
| Outputs | Finance readiness |
| Status transitions | Not ready → billable ready |
| Workspaces | Campaign Finance stage |
| Documents | — |
| Notifications | PO / margin attention |
| Timeline | Finance checkpoints |

#### S15 — Billing

| Field | Definition |
|-------|------------|
| Primary owner | Finance |
| Supporting | Internal Ops, Client (visibility), Executive |
| Actions | Create/approve/post invoices |
| Inputs | Billable assignments, Client IO |
| Outputs | Invoices |
| Status transitions | Draft → approved → posted |
| Workspaces | Finance stage, Finance invoices |
| Documents | Invoice |
| Notifications | Invoice issued |
| Timeline | Invoice lifecycle |

#### S16 — Collections

| Field | Definition |
|-------|------------|
| Primary owner | Finance |
| Supporting | Internal Ops, Client, Executive |
| Actions | Record payments; chase outstanding |
| Inputs | Posted invoices |
| Outputs | Payments / reduced AR |
| Status transitions | Outstanding → partial → paid |
| Workspaces | Collections, Campaign Finance |
| Documents | Payment records |
| Notifications | Payment received / overdue |
| Timeline | Payment events |

#### S17 — Reporting

| Field | Definition |
|-------|------------|
| Primary owner | Executive · Internal Ops |
| Supporting | Client, Commercial, Finance, AI |
| Actions | Generate final/interim reports; share |
| Inputs | Performance + finance facts |
| Outputs | Campaign reports |
| Status transitions | Draft → published |
| Workspaces | Reporting Hub (future), Performance exports |
| Documents | Final report |
| Notifications | Report shared |
| Timeline | Report published |

#### S18 — Campaign Complete

| Field | Definition |
|-------|------------|
| Primary owner | Internal Ops |
| Supporting | All (visibility) |
| Actions | Mark complete/closed; archive cues |
| Inputs | Delivery + collections + reporting done (policy) |
| Outputs | Terminal status |
| Status transitions | Active → completed / closed |
| Workspaces | Overview, Timeline |
| Documents | Final package |
| Notifications | Campaign completed |
| Timeline | Campaign completed |

---

## 5. Workspace ownership registry

Every workspace **must** declare the following (fill as surfaces are migrated):

| Workspace / surface | Lifecycle stage(s) | Owner stakeholder | Visibility | Edit | Approve | Monitor-only |
|---------------------|--------------------|-------------------|------------|------|---------|--------------|
| Campaign Portfolio | Cross-campaign | Internal Ops / Executive | Internal, Executive | Ops | — | Executive |
| Campaign Overview | S00–S01 (+ health) | Internal Ops | Internal, Executive, Commercial | Ops | — | Executive |
| Planning / Studio / Media Plan | S01–S05 | Internal Ops | Internal, Commercial, Client (scoped) | Ops, Commercial | Client (plan/IO rules) | Executive |
| Discovery / Shortlists | S02–S03 | Internal Ops | Internal, Commercial, Client (scoped) | Ops | Client (select) | Executive |
| Assignments | S06 | Internal Ops | Internal, Commercial, Finance, Vendor/Creator (scoped) | Ops | — | Finance, Executive |
| Client IO | S07–S08 | Commercial / Client | Internal, Commercial, Client, Finance | Ops, Commercial | Client | Finance, Executive |
| Vendor IO | S09–S10 | Internal Ops / Vendor / Creator | Internal, Vendor, Creator, Finance | Ops | Vendor/Creator | Finance, Executive |
| Deliverables | S11 | Creator / Internal Ops | Internal, Creator, Vendor, Client (scoped) | Creator, Ops | Client/Ops (content rules) | Executive |
| Performance / Publications | S12–S13 | Internal Ops | Internal, Client, Creator, Vendor, Executive | Ops | — | Executive, Client |
| Campaign Finance | S14–S16 | Finance | Internal, Finance, Executive, Client (scoped) | Finance | Finance | Executive |
| Timeline | All | Internal Ops | Internal | Ops (system) | — | All internal |
| Reporting Hub | S17 | Executive / Ops | Internal, Client (shared reports) | Ops | — | Executive, Client |
| Client Collaboration Portal | S03–S08, S12–S13, S17 | Client | Client (+ internal mirror) | Client (comments) | Client | — |
| Vendor Portal | S09–S11, S16 cues | Vendor | Vendor | Vendor (accept/upload where allowed) | Vendor | — |
| Creator Portal | S10–S12, S16 cues | Creator | Creator | Creator | Creator (accept) | — |
| AI Assist | Current stage | AI (participant) | Acting stakeholder | — | — | — |

Ambiguity is not allowed: if a new workspace cannot fill this row, it is not ready to ship.

---

## 6. Stakeholder journeys (extensions of this lifecycle)

Full journey contracts remain in [`11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md`](./11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md).  
Below are the **required architectural paths** that must stay on the same campaign identity.

### 6.1 Client Collaboration Journey (not “a client view”)

```
Campaign Invitation
        ↓
Campaign Overview
        ↓
Creator Review
        ↓
Creator Selection
        ↓
Comments
        ↓
Approval
        ↓
Campaign Live
        ↓
Performance
        ↓
Final Report
```

| Maps to stages | S03–S08, S12–S13, S17 |
| Same campaign | Always TW-… |
| Future module | Client Collaboration Portal **extends** this journey |

### 6.2 Vendor Journey

```
Vendor Invitation
        ↓
Vendor IO
        ↓
Acceptance
        ↓
Deliverables
        ↓
Completion
        ↓
Finance
        ↓
Payment
```

| Maps to stages | S09–S11, S14–S16 (payment visibility) |
| Future module | Vendor Portal extends this journey |

### 6.3 Creator Journey

```
Invitation
        ↓
Acceptance
        ↓
Content Creation
        ↓
Submission
        ↓
Approval
        ↓
Publication
        ↓
Completion
        ↓
Payment Status
```

| Maps to stages | S10–S12, S16 cues |
| Future module | Creator Portal extends this journey |
| Preserve | Deliverables selection / upload integrity |

### 6.4 Executive Journey

```
Portfolio Overview
        ↓
Campaign Health
        ↓
Financial Health
        ↓
Performance
        ↓
Strategic Reporting
        ↓
Portfolio Analytics
```

| Maps to stages | Cross-spine monitor · S13 · S14–S16 · S17 |
| Character | Analytical; rarely operational |
| Future module | Reporting Hub / Enterprise Analytics extend this journey |

### 6.5 AI Journey

The AI Assistant is **never** a separate product.

It always inherits:

- Current campaign  
- Current lifecycle stage  
- Current stakeholder  
- Current assignments  
- Current IO status  
- Current deliverables  
- Current financial state  

Users must not restate context the system already has.

| Maps to stages | Whatever stage the acting user is in |
| Future module | Media Plan Copilot / Assist docks into this journey |

### 6.6 Internal Ops & Commercial & Finance

Remain as defined in doc 11; they traverse the full or commercial/finance segments of **this same** lifecycle.

---

## 7. Future releases — mandatory mapping

| Release | Lifecycle stage(s) | Stakeholder journey(s) | Constraint |
|---------|-------------------|------------------------|------------|
| Planning Board (2.2a) | S04 Media Planning | Internal Ops, Commercial, Client (review) | No new nav philosophy |
| Media Plan Copilot (2.2b) | S04 (+ Assist) | AI + Internal Ops | In-context only |
| Client Collaboration Journey | S03–S08, S12–S13, S17 | Client | Same campaign OS |
| Vendor Journey | S09–S11, S16 | Vendor | Same campaign OS |
| Creator Journey | S10–S12, S16 | Creator | Same campaign OS |
| Reporting Hub | S17 | Executive, Ops, Client (shared) | Not standalone BI product |
| Notifications | Cross-stage | All | Stage-aware, campaign-bound |
| Enterprise Analytics | S13–S17 + portfolio | Executive | Extends Executive journey |

**No release may:**

- Introduce a new navigation philosophy  
- Introduce a separate application experience  
- Exist outside this Campaign Lifecycle Architecture  

**Every future module extends this architecture.**

---

## 8. Mapping rule for all features

Before any feature ships, answer:

1. Which lifecycle stage ID(s) does it belong to?  
2. Which stakeholder journey(s) does it extend?  
3. What is the workspace ownership row?  
4. How does Business Process Navigation show its state?  
5. What documents / notifications / timeline events does it emit?  

If any answer is missing → redesign the feature placement, do not invent a side product.

---

## 9. Relationship to prior docs

| Doc | Relationship after approval |
|-----|----------------------------|
| 01 Platform UX | Frozen; includes campaign-centric principle |
| 02 Master Navigation | Frozen; process nav must show lifecycle state signals |
| 03 Business Process | Frozen; defers stage SSOT to **this** document |
| 06 Business Lifecycle Model | Frozen; practical rail clusters map to §2 |
| 11 Stakeholder Journeys | Frozen; journeys are lenses on **this** spine |
| 12 (this) | **Highest-level business process SSOT** |

---

## 10. Final approval & Phase 1 gate

### Approve

1. Canonical 19-stage Campaign Lifecycle as platform backbone  
2. Lifecycle Mapping Matrix + Workspace Ownership registry as operational blueprint  
3. Business Process Navigation state signals (completed / blocked / waiting / next action)  
4. Client / Vendor / Creator / Executive / AI journeys as extensions of this lifecycle  
5. Future releases must map into stages — no exceptions  

### Upon approval

| Artifact | State |
|----------|-------|
| Platform UX Architecture | **Frozen** |
| Business Process Architecture | **Frozen** |
| Stakeholder Journey Architecture | **Frozen** |
| Campaign Lifecycle Architecture | **Frozen** |

### Then authorize

**Phase 1 implementation only** — Campaign Process Navigation foundation  
(per [`10-MIGRATION_STRATEGY.md`](./10-MIGRATION_STRATEGY.md)), presentation/IA only, no API/DB/logic changes.

**Implementation remains paused until this document is explicitly approved.**
