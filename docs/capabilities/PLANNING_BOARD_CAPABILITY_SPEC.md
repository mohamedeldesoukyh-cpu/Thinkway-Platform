# Planning Board — Capability Specification (Release 2.2a)

**Status:** In functional capability review — **not an architecture document** · **no implementation**  
**Class:** Capability specification (functional delivery gate)  
**Release:** 2.2a — Campaign Planning Capability / Media Plan Planning Board  
**Review pack:** [`PLANNING_BOARD_CAPABILITY_REVIEW.md`](./PLANNING_BOARD_CAPABILITY_REVIEW.md)  
**Approved baselines (must inherit):**  
- [`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](../architecture/THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)  
- [`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](../architecture/BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md) — protected  
- [`CAMPAIGN_WORKSPACE_BASELINE_V1.md`](../architecture/CAMPAIGN_WORKSPACE_BASELINE_V1.md) — **protected Campaign Workspace Lifecycle OS**  
- [`CAMPAIGN_MODULE_BASELINE.md`](../architecture/CAMPAIGN_MODULE_BASELINE.md)  
- Campaign Lifecycle doc 12 · Stakeholder Journeys doc 11  

**Inheritance rule:** Planning Board is the Planning stage of the Campaign Lifecycle. It extends the Campaign Workspace Lifecycle OS — it does **not** introduce new navigation, layouts, or workflow concepts.

**Technical companion (already approved; subordinate to this capability + frozen architecture):**  
[`RELEASE_2_2A_PLANNING_BOARD_ARCHITECTURE.md`](../architecture/RELEASE_2_2A_PLANNING_BOARD_ARCHITECTURE.md)

**Implementation:** Blocked until capability review is completed **and** this specification is approved.  
**Follow-on:** Media Plan Copilot (2.2b) — separate capability after 2.2a is stable.

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | **S04 Media Planning** (primary); supports readiness into S05–S06 cues; does not redefine S00–S18 |
| Stakeholder Journey(s) extended | **Internal Ops** (primary operator); **Commercial** (planning support); **Client** (review/approve of plan artifacts where already allowed); **AI Assistant** deferred to 2.2b |
| Business Process component(s) reused | BPN foundation; Campaign Workspace Lifecycle OS (State Strip · Process Rail · Next Action); process-aware Media Plan entry; no new nav rail |
| Workspace(s) extended | Existing **Campaign Media Plan** surface inside the Campaign Workspace (Calendar / Original / Actual / Remaining family) |
| Baseline documents referenced | Architecture v1.0; BPN Foundation; Campaign Workspace Baseline v1; Campaign Module Baseline; Financial Display; Lifecycle doc 12; Stakeholder doc 11; R2.2a technical companion |
| No new navigation philosophy | Enters via Campaign Lifecycle → Planning / Media Planning stage; fullscreen board is a **view** inside Campaign Workspace Lifecycle OS |
| No duplicate workflow | Same Assignment-backed schedule + same mutation engine as Calendar; no parallel planner or schedule store |
| Lifecycle extension | Operators schedule creators/deliverables across the campaign window in S04; board advances Media Plan draft → review readiness without inventing a second process |
| Campaign Workspace invariants preserved | Campaign primary · Business Stage SSOT · workspace as view · Next Action journey · no competing nav · extends lifecycle |

---

## 1. Business objective

Give Internal Operations a **high-scale planning surface** (hundreds to ~1,000 creators) to assign and move publishing dates for campaign deliverables — without leaving the campaign, without a second planner product, and without a second schedule ledger.

Operators should experience Planning Board as **work inside S04 Media Planning**, continuous with Calendar / Actual / Remaining, not as a separate application.

---

## 2. Lifecycle stage integration

| Aspect | Specification |
|--------|----------------|
| Canonical stage | **S04 — Media Planning** |
| Practical BPN rail | Planning / Media Plan cluster (existing Campaign → Media Plan entry) |
| Upstream | S02–S03 (creators/shortlist available), S06 Assignments (lines/deliverables exist), campaign window set |
| Downstream | Plan review/approval cues; readiness for Client review paths already supported by Media Plan; later S11–S13 execution views remain unchanged |
| Process signals | Board activity remains under Media Planning; portfolio/workspace BPN heuristics continue to use existing fields (no new workflow engine) |

**Non-integration:** Planning Board must not create a peer top-level nav item, peer “Planning app”, or alternate lifecycle.

---

## 3. Stakeholder interactions

| Stakeholder | Interaction in 2.2a |
|-------------|---------------------|
| Internal Ops | Primary: open board, search/filter creators, drag/move dates, bulk move, expand deliverables |
| Commercial | Supporting: same campaign context; may review schedule outcomes via existing Media Plan views |
| Client | No new portal in 2.2a; continues via existing plan share/approve paths if already enabled |
| Vendor / Creator | No new journey in 2.2a; schedule remains internal ops SSOT until later journey releases |
| Finance / Executive | Unaffected; finance KPIs and billing paths untouched |
| AI Assistant | **Out of scope** — Release 2.2b only |

---

## 4. Entry and exit criteria

### Entry (capability may be used when)

- User can open the campaign’s existing Media Plan workspace.  
- Campaign has Assignment-backed schedule grain (lines / deliverables / posts) loadable by current Media Plan loaders.  
- R2.1 grain locks and campaign-window rules remain enforced on write.  
- Planning Board control is **shown only when the release is live** (never as a disabled stub).

### Exit (S04 planning work for a session / version)

- Schedule changes persist through the **shared mutation path** and appear identically on Calendar / Actual / Remaining.  
- Every confirmed move/bulk move emits Enterprise Timeline / audit events (existing contract).  
- User can return to Campaign Workspace process navigation without losing campaign context.  
- Media Plan version / approval states continue to follow existing Media Plan rules (board does not invent approval states).

### Release exit (2.2a done)

See §8 Success criteria.

---

## 5. Workspace behavior

| Behavior | Spec |
|----------|------|
| Shell | Remain inside Campaign identity (document number, name, crumbs, back to campaign). Prefer Media Plan chrome continuity; fullscreen board allowed as Commercial Workspace–style **view overlay**, not a new product shell |
| Navigation | No new platform nav; no new Campaign process-rail stage. Entry is a Media Plan view/launcher (“Planning Board”) alongside Calendar / Original / Actual / Remaining |
| Layout | Left: creators (identity, platform, deliverables, status) with search/filter/virtualization. Right: publishing date columns with creators/slots |
| Interactions | Single drag date change; deliverable-level move; multi-select + bulk move to target date |
| Persistence | Writes only via existing schedule mutation + R2.1 guards |
| Design language | Aurora / Campaign Module Baseline; Financial Display if any money appears (unlikely on board) |
| Hidden until live | Do not show Planning Board in hero/primary actions before ship |

**Explicitly not in workspace behavior:** new Enterprise Tab, new BPN stage id, Studio redesign, Finance merge, portal chrome.

---

## 6. User flows

### 6.1 Continue from Campaign

1. Operator is on a campaign (portfolio continue-into-stage or workspace).  
2. Enters Media Plan (S04 surface) via existing campaign entry points.  
3. Opens **Planning Board** view.  
4. Campaign context (TW-…, name, window) remains visible.  
5. Schedules via drag/bulk move → confirms if required by engine → sees same result on Calendar.  
6. Returns to Media Plan or Campaign Workspace process rail without re-orienting to a different app.

### 6.2 High-scale reschedule

1. Filter/search creators on the left.  
2. Multi-select creators or deliverables.  
3. Bulk Move → choose target publishing date.  
4. Engine excludes locked/billing-locked grains with clear feedback.  
5. Timeline records the change; Remaining/Actual reflect shared state.

### 6.3 Partial deliverable move

1. Expand creator.  
2. Move one deliverable type (e.g. Story) without moving another (e.g. Reel).  
3. Same mutation path and audit as calendar-level edits.

---

## 7. Reuse of existing platform components

| Reuse | Do not create |
|-------|----------------|
| Campaign Module Baseline shell / Aurora | New design system or Campaign redesign |
| Business Process Navigation / campaign context | New navigation philosophy or peer module |
| Media Plan loaders, projections, schedule engine | Parallel schedule store or sync jobs |
| `updateMediaPlanSchedule` (+ grain guards, window rules) | Board-specific write API that bypasses guards |
| Assignment identity (`campaignLineId` → deliverable → post) | Label-only joins for writes |
| Enterprise Timeline / `audit_logs` | Side audit channel |
| Commercial Workspace interaction patterns (fullscreen, virtualization, multi-select) | Unrelated third planner UX language |
| Existing Media Plan PDF / portal share paths | New client portal for 2.2a |

Technical detail remains in the R2.2a companion doc; this capability spec does not reopen architecture.

---

## 8. Success criteria

Capability is successful when:

1. Operators treat Planning Board as **part of S04 Media Planning**, not a separate product.  
2. **300–1,000** creator campaigns remain usable (virtualization / pagination budgets).  
3. Drag-and-drop and bulk move are accurate and predictable.  
4. Calendar and Planning Board produce **identical** schedule results (one SSOT).  
5. All schedule changes are audited on the Enterprise Timeline contract.  
6. No regressions in Original / Actual / Remaining / approve-lock / grain guards.  
7. No new navigation model, process rail stage, workflow engine, or database ledger is introduced.  
8. Platform Architecture Compliance remains true at ship time.

---

## 9. Non-goals (capability)

- Media Plan Copilot / AI (2.2b)  
- Client / Vendor / Creator journey portals  
- New lifecycle stages or BPN redesign  
- Commercial SSOT, Convert, CIO, VIO, Billing redesign  
- Architecture reopen or UX redesign initiatives  

---

## 10. Approval gate

| Gate | Owner | Status |
|------|-------|--------|
| Architecture v1.0 + BPN Foundation | Product | Approved / frozen / protected |
| Functional capability review | Product / Ops | **In progress** — see review pack |
| This Capability Specification | Product | Blocked on review completion |
| Implementation on `develop` | Engineering | **Blocked** — no code until review + spec approval |
| Production | Product | Separate explicit approval |

**Once the functional capability review is completed and this specification is approved, Release 2.2a implementation may begin** under Dev-first rules (`develop` → Development Supabase only unless Production is explicitly approved).
