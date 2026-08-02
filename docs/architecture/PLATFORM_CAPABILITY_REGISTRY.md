# Platform Capability Registry

**Status:** Permanent governance registry — **canonical**  
**Updated:** 2026-08-02  
**Parent:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)

Every future enterprise module must **extend** registered capabilities. Parallel engines are forbidden.

---

## Registered capabilities

| Capability | Status | Code | Spec | Mandatory for |
|------------|--------|------|------|----------------|
| Platform Bulk Operations Framework | Frozen · mandatory | `components/workspace/bulk-operations/` | [`PLATFORM_BULK_OPERATIONS_FRAMEWORK.md`](./PLATFORM_BULK_OPERATIONS_FRAMEWORK.md) | All register multi-select work |
| Enterprise Document Lifecycle Engine | Active · mandatory for docs | `lib/document-lifecycle/` | [`ENTERPRISE_DOCUMENT_LIFECYCLE.md`](./ENTERPRISE_DOCUMENT_LIFECYCLE.md) | Document state transitions only |
| **Enterprise Change Impact Engine** | **Frozen · protected · mandatory** | `lib/change-impact/` | [`ENTERPRISE_CHANGE_IMPACT_ENGINE.md`](./ENTERPRISE_CHANGE_IMPACT_ENGINE.md) | Every business-change interpretation |

---

## Enterprise Change Impact Engine (protected)

### Responsibility

Interpret Business Change Events; determine affected objects and documents; assign exactly one severity; explain business impact; recommend owned actions; feed Decision Center, Timeline, Notifications, and AI-ready / future Reporting / Mobile consumers from **one identical assessment**.

### Canonical entry point (SSOT)

```ts
import { applyBusinessChangeImpact } from "@/lib/change-impact";
// alias: assessAndApplyBusinessChange
```

No module may invent a second impact interpreter. Document Lifecycle may only plan/apply **document state transitions**.

### Inputs

- Business change event type + reason code/detail  
- Campaign context + optional line / influencer / vendor IO filters  
- Optional estimated commercial delta  

### Outputs (one assessment)

- Affected business objects  
- Impacted documents  
- Severity (`critical|high|medium|low|info` ↔ Critical|Major|Moderate|Minor|Informational)  
- Explainability (what / why / affected / next / owner)  
- Recommended actions with owners  
- Notification intents · Timeline event · AI-ready context  
- Lifecycle reactions (handed to Document Lifecycle)

### Consumers (must not reinterpret events)

| Consumer | Feed |
|----------|------|
| Decision Center | `change_impact_signals` → blockers |
| Timeline | `feedChangeImpactTimeline` |
| Notifications | `change_impact_notification_intents` |
| Future AI | `ai_context` / `aiRecommendation` |
| Future Reporting | assessment tables |
| Future Mobile | same assessment API/projection |

### Extension rules

1. New business events → register event type + assessment rules in Change Impact.  
2. New document types → Document Lifecycle policies + Change Impact document-impact planning.  
3. Never bypass `applyBusinessChangeImpact` for business-change interpretation.  
4. Quotation / PO / Invoice / Contract / Report lifecycles **must extend this engine** — no parallel impact logic.

### Governance

- Freeze tip: see [`ENTERPRISE_CHANGE_IMPACT_ENGINE.md`](./ENTERPRISE_CHANGE_IMPACT_ENGINE.md)  
- Acceptance: [`ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md`](./ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md)  
- Production DB changes require explicit approval (Development-first)
