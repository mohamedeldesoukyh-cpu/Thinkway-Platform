# Platform Architecture Compliance (Mandatory)

**Status:** Permanent governance rule  
**Baseline:** [`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)  
**BPN foundation:** [`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md)  
**Campaign Workspace baseline (canonical):** [`CAMPAIGN_WORKSPACE_BASELINE_V1.1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.1.md)  
**Historical:** [`CAMPAIGN_WORKSPACE_BASELINE_V1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.md)  
**Effective:** 2026-08-01 (Architecture v1.0 freeze)  
**Updated:** 2026-08-01 (Campaign Workspace Baseline v1.1 — Release 2.2b Decision Center freeze)

---

## Rule

Every future **Architecture Decision Record (ADR)**, **Release Architecture** document, **capability specification**, and **implementation proposal** must contain a section titled exactly:

```
## Platform Architecture Compliance
```

Omit this section → the proposal is incomplete and must not be approved for implementation.

---

## Required content

The section must explicitly state:

1. **Which Campaign Lifecycle stage(s) it extends** — use stage IDs from [`platform-ux/12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./platform-ux/12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md) (e.g. `S04 Media Planning`).  
2. **Which Stakeholder Journey(s) it extends** — Internal Ops · Commercial · Client · Vendor · Creator · Finance · Executive · AI Assistant ([doc 11](./platform-ux/11-STAKEHOLDER_JOURNEY_ARCHITECTURE.md)).  
3. **Which Business Process component(s) it reuses** — e.g. `lib/business-process`, stage summary, process-aware Enterprise Tabs, Decision Center, campaign process adapter, portfolio continue-into-stage patterns ([BPN foundation](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md)).  
4. **Which workspace(s) are extended** — name existing surfaces; do not invent a peer product.  
5. **Which existing baseline document(s) are referenced** — cite Architecture v1.0, BPN foundation, **Campaign Workspace Baseline v1.1**, and any module baselines.  
6. **Why it does not introduce a new navigation philosophy** — confirm Platform → Module → Business Process Navigation → Content; no parallel tab/app system.  
7. **Why no duplicate workflow is created** — confirm the feature extends the campaign lifecycle, not a side process.  
8. **How the feature extends the existing campaign lifecycle** — one paragraph mapping inputs/outputs to stage transitions.

Items **1, 2, 3, and 6** are the non-negotiable BPN gate for all future releases.

---

## Campaign Workspace invariants (mandatory)

Any change that touches Campaign Workspace presentation, navigation, empty states, portfolio campaign columns, or lifecycle orchestration **must preserve**:

### Core (v1.0 — still in force)

1. **Campaign remains the primary business object** — screens orient around one campaign, not disconnected modules.  
2. **Business Stage is always the source of truth** — independent of which workspace tab is open.  
3. **Workspaces are contextual views, not separate applications** — Finance, Vendor IO, Performance, etc. open into the same lifecycle.  
4. **Next Action remains the primary user journey** — hero, state strip, and portfolio continue into the recommended stage.  
5. **No competing navigation patterns** — do not introduce parallel tab/app systems beside Business Process Navigation / process rail.  
6. **New capabilities extend the lifecycle instead of bypassing it** — e.g. Planning Board plugs into Planning; stakeholder portals are windows into the same journey.

### Decision Center / Lifecycle OS v1.1 (Release 2.2b)

**Invariant 1 — Lifecycle-driven workspace**  
Campaign Workspace remains lifecycle-driven. Business Stage remains the Single Source of Truth.

**Invariant 2 — Decision Center exclusivity**  
Decision Center is the only operational guidance component. Future capabilities must extend it. Do not introduce competing guidance panels.

**Invariant 3 — Shared lifecycle object**  
All lifecycle guidance must come from the shared `CampaignLifecycleView` / `decisionCenter` object. No workspace may calculate lifecycle independently.

**Invariant 4 — Decision questions**  
All lifecycle actions must answer: What happened? Why am I here? What do I do next? What unlocks after completion?

**Invariant 5 — Hard Block ≠ Needs Attention**  
Hard Block and Needs Attention are different concepts. Soft enforcement must never appear as Blocked.

**Invariant 6 — Progressive disclosure**  
Lifecycle Details remain progressive disclosure. Operational workspace always starts above the fold.

Canonical reference: [`CAMPAIGN_WORKSPACE_BASELINE_V1.1.md`](./CAMPAIGN_WORKSPACE_BASELINE_V1.1.md).  
Regression gate (protected): `npm run test:campaign-workspace-lifecycle-os`.

---

## Template (copy into every ADR / capability spec / release architecture / proposal)

```markdown
## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | e.g. S04 Media Planning |
| Stakeholder Journey(s) extended | e.g. Internal Ops, Commercial, Client |
| Business Process component(s) reused | e.g. lib/business-process; Decision Center; State Strip; Process Rail; process-aware Enterprise Tabs |
| Workspace(s) extended | e.g. Campaign Media Plan surface within Campaign Workspace |
| Baseline documents referenced | Architecture v1.0; BPN Foundation; Campaign Workspace Baseline v1.1; Campaign Module Baseline; … |
| No new navigation philosophy | Extends Business Process Navigation; no parallel tab/app system |
| No duplicate workflow | Extends campaign lifecycle stage(s) above; no side process |
| Lifecycle extension | …how this capability advances or supports the stage… |
| Campaign Workspace invariants preserved | Campaign primary · Business Stage SSOT · Decision Center exclusive · shared lifecycle object · Next Action journey · Hard≠Attention · progressive disclosure · no competing nav · extends lifecycle |
```

---

## Forbidden without formal architecture reopen

- Redefining navigation, workspace, or business-process philosophy  
- Creating a separate application experience  
- Shipping a feature that cannot map to a lifecycle stage  
- Introducing a new navigation model alongside Business Process Navigation  
- Treating Campaign workspaces as independent apps with their own journey model  
- Bypassing Next Action / Business Stage for a parallel “home” experience inside Campaign  
- Introducing competing guidance panels beside the Decision Center  
- Recalculating lifecycle independently inside a workspace tab  
- Redesigning Decision Center philosophy, Hero, or Lifecycle OS without reopen  
- Omitting this compliance section  

---

## Campaign Workspace Maintenance Mode

After Baseline v1.1 freeze, Campaign Workspace permits only: bug fixes · performance · accessibility · copy · lifecycle extensions that preserve the baseline.  
Navigation / workspace / hero / lifecycle redesigns and alternative guidance systems require Architecture Reopen.

---

## Cursor / engineering enforcement

See `.cursor/rules/thinkway-platform-architecture-v1.mdc`.
