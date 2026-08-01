# Platform Architecture Compliance (Mandatory)

**Status:** Permanent governance rule  
**Baseline:** [`THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md`](./THINKWAY_ENTERPRISE_PLATFORM_ARCHITECTURE_V1.md)  
**Effective:** 2026-08-01 (Architecture v1.0 freeze)

---

## Rule

Every future **Architecture Decision Record (ADR)**, **Release Architecture** document, and **implementation proposal** must contain a section titled exactly:

```
## Platform Architecture Compliance
```

Omit this section → the proposal is incomplete and must not be approved for implementation.

---

## Required content

The section must explicitly state:

1. **Which lifecycle stages are affected** — use stage IDs from [`platform-ux/12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md`](./platform-ux/12-CAMPAIGN_LIFECYCLE_ARCHITECTURE.md) (e.g. `S04 Media Planning`).  
2. **Which stakeholder journeys are affected** — Internal Ops · Commercial · Client · Vendor · Creator · Finance · Executive · AI Assistant.  
3. **Which workspace(s) are extended** — name existing surfaces; do not invent a peer product.  
4. **Which existing baseline document(s) are referenced** — cite Architecture v1.0 docs and any module baselines.  
5. **Why no new navigation philosophy is introduced** — confirm Platform → Module → Business Process → Content.  
6. **Why no duplicate workflow is created** — confirm the feature extends the campaign lifecycle, not a parallel process.  
7. **How the feature extends the existing campaign lifecycle** — one paragraph mapping inputs/outputs to stage transitions.

---

## Template (copy into every ADR / release architecture / proposal)

```markdown
## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Lifecycle stages affected | e.g. S04 Media Planning, S08 Client Approval |
| Stakeholder journeys affected | e.g. Internal Ops, Client, AI Assistant |
| Workspace(s) extended | e.g. Campaign Planning cluster / Media Plan surface |
| Baseline documents referenced | Thinkway Enterprise Platform Architecture v1.0; doc 12; … |
| No new navigation philosophy | Extends Business Process Navigation; no parallel tab/app system |
| No duplicate workflow | Extends campaign lifecycle stage(s) above; no side process |
| Lifecycle extension | …how this feature advances or supports the stage… |
```

---

## Forbidden without formal architecture reopen

- Redefining navigation, workspace, or business-process philosophy  
- Creating a separate application experience  
- Shipping a feature that cannot map to a lifecycle stage  
- Omitting this compliance section  

---

## Cursor / engineering enforcement

See `.cursor/rules/thinkway-platform-architecture-v1.mdc`.
