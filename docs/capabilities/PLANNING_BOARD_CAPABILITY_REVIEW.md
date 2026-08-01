# Planning Board — Functional Capability Review

**Status:** Open for Product / Operations / Enterprise Workflow review  
**Class:** Capability review pack — **not architecture · not implementation**  
**Subject:** [`PLANNING_BOARD_CAPABILITY_SPEC.md`](./PLANNING_BOARD_CAPABILITY_SPEC.md)  
**Technical companion (reference only):** [`../architecture/RELEASE_2_2A_PLANNING_BOARD_ARCHITECTURE.md`](../architecture/RELEASE_2_2A_PLANNING_BOARD_ARCHITECTURE.md)  
**Baselines in force:** Architecture v1.0 · [`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](../architecture/BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md) · Campaign Module Baseline  

**Implementation:** **Blocked** until this review is completed and approved.

---

## Review objective

Ensure Planning Board becomes the **natural Planning / Media Planning (S04) work surface** of the Campaign Lifecycle — not an independent workspace, module, or application.

Review lenses: product · operational · enterprise workflow.

---

## Platform Architecture Compliance (review scope)

| Item | Spec claim | Review focus |
|------|------------|--------------|
| Lifecycle stage(s) | S04 Media Planning | Is every flow still “inside” S04? |
| Stakeholder journeys | Ops primary; Commercial support; Client via existing paths | Are journeys complete enough for MVP without parallel portals? |
| BPN components reused | Campaign context, Media Plan entry, no new rail | Does fullscreen board still feel like BPN, not a peer app? |
| No new navigation philosophy | View inside Media Plan family | Any risk of a second planner OS? |

---

## 1. Business objective

| Criterion | Assessment | Finding |
|-----------|------------|---------|
| Clarity | **Pass** | High-scale scheduling for Internal Ops without a second planner or ledger. |
| Campaign-centric | **Pass** | Explicitly “work inside S04,” continuous with Calendar / Actual / Remaining. |
| Risk | Watch | “Commercial Workspace–style fullscreen” can read as a separate product if campaign/process chrome is weak. |

**Review question:** Does Product accept “fullscreen view overlay of Media Plan” as still one Campaign OS experience, provided campaign identity + return path are mandatory?

---

## 2. Alignment with Campaign Lifecycle

| Criterion | Assessment | Finding |
|-----------|------------|---------|
| Canonical stage | **Pass** | Correctly maps to **S04 Media Planning** (doc 12). |
| Upstream | **Pass with note** | Spec cites S02–S03, S06 Assignments, campaign window. In Thinkway, Assignments (S06) often **seed** Media Plan — board must assume Assignment grain exists, not invent creators. |
| Downstream | **Pass** | Does not invent approval states; defers to existing Media Plan version / share / approve. |
| Stage purity | **Pass** | No new S-id; no alternate lifecycle. |

**Review question:** Confirm Product wording: Planning Board is an **S04 work surface**, even when Assignment lines (S06 objects) are the schedule grain — lifecycle stage of *work* is Media Planning; data objects remain Assignments.

---

## 3. Alignment with Business Process Navigation

| Criterion | Assessment | Finding |
|-----------|------------|---------|
| No new process-rail stage | **Pass** | Entry via Media Plan launcher, not a new Enterprise Tab / BPN stage. |
| Portfolio continue-into-stage | **Gap** | Spec flow 6.1 starts from campaign → Media Plan → Board. It does not yet state how BPN “Current Stage / Next Action” should label Media Planning when the board is the expected work. |
| Process context on board | **Gap** | Spec requires campaign crumbs/identity; does not yet require stage summary cues (Current Stage · Owner · Status · Next · Waiting For) on or above the board. |
| Never trap users | **Pass** | Return to Media Plan / Campaign Workspace required; full lifecycle remains navigable. |

**Review questions:**

1. Must the Planning Board chrome show a compact **Business Process Stage Summary** (or equivalent) so operators never lose “I am in Media Planning”?  
2. Should portfolio Next Action ever deep-link **directly** to Planning Board once live, or only to Media Plan (board as secondary view)?

**Recommendation for spec amendment (if Product agrees):** Mandate visible campaign + S04 process context on the board; prefer deep-link to Media Plan with Board as default view only when Product wants one-click — never a peer URL that drops BPN.

---

## 4. Stakeholder interactions

| Stakeholder | Spec | Review |
|-------------|------|--------|
| Internal Ops | Primary operator on board | **Pass** — clear ownership of scheduling work |
| Commercial | Review via existing Media Plan views | **Pass for MVP** — no Commercial-only board mode required |
| Client | Existing share/approve only | **Pass for MVP** — Client Collaboration is a later capability |
| Vendor / Creator | Out of scope | **Pass** — avoids premature journey sprawl |
| Finance / Executive | Untouched | **Pass** |
| AI | Deferred to 2.2b | **Pass** |

**Review question:** Is MVP acceptable without in-board Client collaboration, given Client journey is a later release?

---

## 5. User journeys

| Journey | Spec coverage | Assessment |
|---------|---------------|------------|
| Ops continues from Campaign → Media Plan → Board → back | §6.1 | **Pass** |
| High-scale reschedule (filter → multi-select → bulk move) | §6.2 | **Pass** |
| Partial deliverable move | §6.3 | **Pass** |
| Ops lands from portfolio recommended stage | Implicit | **Needs clarification** (see §3) |
| Commercial reviews schedule | Via existing views | **Pass for MVP** |
| Client approves plan | Existing paths | **Pass for MVP** |

**Enterprise workflow check:** Journeys stay on one campaign spine. No portal hop required for 2.2a.

---

## 6. Operational workflows

| Workflow | Assessment | Finding |
|----------|------------|---------|
| Single drag date change | **Pass** | Same mutation path as Calendar |
| Bulk move with lock exclusions | **Pass** | R2.1 guards + clear feedback required |
| Campaign window enforcement | **Pass** | Inherited from existing engine |
| Audit / Timeline | **Pass** | Every confirmed change |
| Failure / locked grain UX | **Watch** | Spec references exclusions; Product should confirm operator messaging standard (toast vs panel vs disabled drop) |

**Review question:** What is the operational standard when 40 of 200 selected items are billing-locked — summary dialog required before confirm?

---

## 7. Data ownership

| Concern | Spec / companion | Assessment |
|---------|------------------|------------|
| Who owns the schedule | Internal Ops operates; Assignment + Media Plan engine persist | **Pass** — should be stated explicitly in capability spec |
| Media Plan object role | View / version envelope over Assignment-backed schedule | **Pass** |
| No board-private store | Explicit non-goal | **Pass** |
| Commercial / Finance data | Untouched | **Pass** |

**Recommended explicit ownership statement (for Product confirmation):**

> Publishing dates are owned as Assignment schedule grain. Planning Board and Calendar are peer **views**. Media Plan versioning/approval remains the existing Media Plan capability — the board does not own a second dataset.

---

## 8. Assignment SSOT compliance

| Rule | Assessment |
|------|------------|
| One Assignment-backed schedule | **Pass** |
| Writes only via shared mutation + grain guards | **Pass** |
| Identity via `campaignLineId` → deliverable → post | **Pass** |
| Calendar ≡ Board results | **Pass** (success criterion #4) |
| No sync jobs / dual-write | **Pass** |

**Hard gate:** Any implementation that introduces a board-only store or bypasses `updateMediaPlanSchedule` / R2.1 guards fails this review — even if UX is excellent.

---

## 9. Entry and exit criteria

| Gate | Assessment | Finding |
|------|------------|---------|
| Entry via existing Media Plan | **Pass** | |
| Hidden until live | **Pass** | Aligns with Campaign Baseline |
| Exit persists via shared path | **Pass** | |
| Return without losing campaign context | **Pass** | |
| Does not invent approval states | **Pass** | |
| BPN entry/exit language | **Gap** | Add: enter as S04 work; exit leaves stage cues coherent on Campaign Workspace |

---

## 10. Success criteria

| Criterion | Assessment |
|-----------|------------|
| Feels like S04, not a separate product | **Pass** — primary success bar; must be UAT-tested with ops |
| 300–1,000 creators usable | **Pass** |
| DnD + bulk accuracy | **Pass** |
| Calendar ≡ Board | **Pass** |
| Audit complete | **Pass** |
| No Media Plan regressions | **Pass** |
| No new nav / ledger / workflow engine | **Pass** |
| Compliance true at ship | **Pass** |

**Suggested UAT probe:** After using the board, can an operator answer BPN questions without leaving the campaign — Where am I? What’s next? Who’s waiting? — using only chrome already on screen?

---

## 11. Reuse of existing platform components

| Reuse target | Assessment |
|--------------|------------|
| Campaign Module Baseline / Aurora | **Pass** |
| BPN / campaign context | **Pass with strengthening** (see §3 gaps) |
| Media Plan loaders / engine / mutation | **Pass** |
| Assignment identity + R2.1 locks | **Pass** |
| Enterprise Timeline | **Pass** |
| Commercial Workspace interaction patterns | **Pass** — pattern reuse, not product fork |
| No new Client portal | **Pass** |

---

## 12. UX consistency with Business Process Navigation Foundation

| BPN expectation | Spec today | Verdict |
|-----------------|------------|---------|
| One campaign OS | Campaign identity + return path | **Mostly pass** |
| Process over pages | Board as Media Plan view | **Pass** if chrome stays process-led |
| Stage / owner / next / waiting cues | Not yet mandated on board | **Amend recommended** |
| No parallel nav | No new rail / tab | **Pass** |
| Continue-into-stage | Portfolio → Media Plan path only | **Clarify** |

**UX consistency principle for approval:**

> Planning Board may go fullscreen for density, but it must never feel like leaving the campaign’s business process. Campaign identity and Media Planning stage context are mandatory; escaping to a “planner app” chrome is a failed design.

---

## Review verdict (pre-Product)

| Dimension | Result |
|-----------|--------|
| Direction vs Architecture v1.0 / BPN | **Aligned** |
| Assignment SSOT | **Aligned** |
| Risk of independent workspace | **Controllable** — close §3 / §12 gaps in capability spec before coding |
| Ready to implement? | **No** — await Product completion of this review |

### Open items for Product / Ops (must resolve before implementation approval)

1. Confirm fullscreen board is acceptable if **campaign + S04 process context** remain visible.  
2. Decide portfolio/recommended-stage deep-link target: Media Plan only vs Media Plan with Board focused.  
3. Confirm MVP without in-board Client collaboration.  
4. Confirm bulk-move lock exclusion UX (summary before confirm).  
5. Approve explicit **Assignment schedule ownership** wording (§7).  
6. Approve amended capability spec (if items 1–5 require edits) → then authorize coding.

---

## Approval record

| Gate | Owner | Status |
|------|-------|--------|
| BPN Foundation + Architecture v1.0 | Product | **Approved** (protected baseline) |
| Platform Architecture Compliance permanence | Product | **Approved** |
| This functional capability review | Product / Ops | **In progress** |
| Planning Board Capability Specification (amended if needed) | Product | Blocked on review completion |
| Implementation (Release 2.2a) | Engineering | **Blocked** |
| Production | Product | Separate explicit approval |

---

## Closing

No Planning Board code should be written until:

1. This review is completed,  
2. Open items are resolved,  
3. The Capability Specification is approved (with any agreed amendments), and  
4. Product explicitly authorizes implementation on `develop`.
