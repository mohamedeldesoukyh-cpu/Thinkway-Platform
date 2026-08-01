# Platform Architecture Compliance (Mandatory)

**Status:** Permanent governance rule  
**Baseline:** [`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)  
**BPN foundation:** [`BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md`](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md)  
**Effective:** 2026-08-01 (Architecture v1.0 freeze)  
**Updated:** 2026-08-01 (Business Process Navigation Foundation Complete)

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
3. **Which Business Process component(s) it reuses** — e.g. `lib/business-process`, stage summary, process-aware Enterprise Tabs, campaign process adapter, portfolio continue-into-stage patterns ([BPN foundation](./BUSINESS_PROCESS_NAVIGATION_FOUNDATION.md)).  
4. **Which workspace(s) are extended** — name existing surfaces; do not invent a peer product.  
5. **Which existing baseline document(s) are referenced** — cite Architecture v1.0, BPN foundation, and any module baselines.  
6. **Why it does not introduce a new navigation philosophy** — confirm Platform → Module → Business Process Navigation → Content; no parallel tab/app system.  
7. **Why no duplicate workflow is created** — confirm the feature extends the campaign lifecycle, not a side process.  
8. **How the feature extends the existing campaign lifecycle** — one paragraph mapping inputs/outputs to stage transitions.

Items **1, 2, 3, and 6** are the non-negotiable BPN gate for all future releases.

---

## Template (copy into every ADR / capability spec / release architecture / proposal)

```markdown
## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) extended | e.g. S04 Media Planning |
| Stakeholder Journey(s) extended | e.g. Internal Ops, Commercial, Client |
| Business Process component(s) reused | e.g. lib/business-process; stage summary; process-aware Enterprise Tabs |
| Workspace(s) extended | e.g. Campaign Media Plan surface within Campaign Workspace |
| Baseline documents referenced | Architecture v1.0; BPN Foundation; Campaign Module Baseline; … |
| No new navigation philosophy | Extends Business Process Navigation; no parallel tab/app system |
| No duplicate workflow | Extends campaign lifecycle stage(s) above; no side process |
| Lifecycle extension | …how this capability advances or supports the stage… |
```

---

## Forbidden without formal architecture reopen

- Redefining navigation, workspace, or business-process philosophy  
- Creating a separate application experience  
- Shipping a feature that cannot map to a lifecycle stage  
- Introducing a new navigation model alongside Business Process Navigation  
- Omitting this compliance section  

---

## Cursor / engineering enforcement

See `.cursor/rules/thinkway-platform-architecture-v1.mdc`.
