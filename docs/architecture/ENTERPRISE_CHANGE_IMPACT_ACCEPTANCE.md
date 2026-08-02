# Enterprise Change Impact Engine — Final Product Acceptance

**Date:** 2026-08-02  
**Verdict:** **ACCEPTED & FROZEN** (with documented event backlog)  
**Freeze tip:** `develop` after Change Impact acceptance commit  
**Registry:** [`PLATFORM_CAPABILITY_REGISTRY.md`](./PLATFORM_CAPABILITY_REGISTRY.md)  
**Spec:** [`ENTERPRISE_CHANGE_IMPACT_ENGINE.md`](./ENTERPRISE_CHANGE_IMPACT_ENGINE.md)

---

## Gate results

| # | Gate | Result | Evidence |
|---|------|--------|----------|
| 1 | Single Source of Truth | **PASS** | Canonical entry: `applyBusinessChangeImpact` / `assessAndApplyBusinessChange`. Compatibility shim `emitBusinessChangeEvent` delegates to the same path — no parallel engine. |
| 2 | Business Event Coverage | **PASS** (backlog recorded) | Supported events produce deterministic assessments. Unsupported campaign events listed as future backlog (below). |
| 3 | Impact Assessment completeness | **PASS** | Assessment includes affected objects, documents, severity, explainability (5 questions), recommended actions, responsible owner. |
| 4 | Feed consistency | **PASS** | Decision Center, Timeline, Notifications, AI context all read the same persisted assessment / identical in-memory object — no independent reinterpretation. |
| 5 | Explainability | **PASS** | `explainability`: whatChanged · whyImportant · whatAffected · whatShouldHappenNext · whoOwnsTheAction. |
| 6 | Severity model | **PASS** | Product labels Critical · Major · Moderate · Minor · Informational (storage codes critical/high/medium/low/info; one level only). |
| 7 | Platform Registry | **PASS** | Registered as frozen protected capability in Platform Capability Registry. |
| 8 | Future compatibility | **PASS** | Assessment + feeds are workspace-agnostic; Planning / portals / Reporting / AI / Mobile consume projections without redesign. |
| 9 | Operational effort | **PASS** | Explanations name exact documents, reason, owner, and next action — reduces investigation and coordination for supported events. |
| 10 | Final freeze | **PASS** | Engine frozen; Quotation/PO/Invoice/Contract/Report lifecycles must extend this engine. |

---

## Business event coverage matrix

### Supported now (deterministic assessment)

| Business event | Event type | Wired producers | Notes |
|----------------|------------|-----------------|-------|
| Creator price changed | `creator_price_updated` | Assignment commercial update | → Revision Required on issued IOs |
| Deliverables changed | `deliverables_changed` | Ready (call site backlog) | Assessment rules exist |
| Payment terms changed | `payment_terms_changed` | Ready (call site backlog) | Assessment rules exist |
| Budget changed | `campaign_budget_changed` | Ready (call site backlog) | Assessment rules exist |
| Creator removed | `creator_removed` | Ready (call site backlog) | Cancels non-Accepted Vendor IOs |
| Creator replaced | `creator_replaced` | Ready (call site backlog) | Cancels non-Accepted Vendor IOs |
| Campaign cancelled | `campaign_cancelled` | Cancellation engine | Accepted docs preserved |
| Manual mark revision | `manual_mark_revision_required` | Commercial correction path | |

### Future backlog (must extend this engine — no parallel logic)

| Business event | Status |
|----------------|--------|
| Creator added | Backlog — register event + assessment rules |
| Timeline / schedule changed | Backlog |
| Campaign resumed | Backlog |
| Client approval | Backlog (may also emit Document Lifecycle transition) |
| Vendor rejection | Backlog |
| Deliverables changed (auto-detect from deliverable mutations) | Wire call site |
| Payment terms changed (auto-detect) | Wire call site |
| Budget changed (auto-detect) | Wire call site |
| Creator removed / replaced (auto-detect from assignment ops) | Wire call site |

---

## Severity taxonomy (product SSOT)

| Storage | Product label | Decision Center mapping |
|---------|---------------|-------------------------|
| `critical` | Critical | business_blocker |
| `high` | Major | operational_attention |
| `medium` | Moderate | operational_attention |
| `low` | Minor | optimization |
| `info` | Informational | optimization |

Exactly one level per assessment.

---

## Feed contract

```
applyBusinessChangeImpact
  → one ChangeImpactAssessment
  → persist assessment (+ objects, document impacts, notification intents)
  → Timeline emit (same assessment)
  → Document Lifecycle apply (state only)
  → Decision Center loads open assessments (same rows)
  → AI / Reporting / Mobile read same assessment shape
```

---

## Freeze rules

1. Do **not** create parallel impact interpreters.  
2. Do **not** begin Quotation / PO / Invoice / Contract / Report document lifecycles until they **extend** Change Impact + Document Lifecycle.  
3. New business events → add to Change Impact event registry first.  
4. Document Lifecycle remains state-transition only.  
5. Platform Architecture · BPN · Campaign Lifecycle OS unchanged by this freeze.
