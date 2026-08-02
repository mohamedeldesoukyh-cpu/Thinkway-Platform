# Platform Capability Registry

**Status:** Permanent governance registry — **canonical**  
**Updated:** 2026-08-02 — Release 2.3 Phase 1 · Enterprise Creator Intelligence (Sprint 1 Active)  
**Parent:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)

Every future enterprise module must **extend** registered capabilities. Parallel engines are forbidden.

---

## Registered capabilities

| Capability | Status | Code | Spec | Mandatory for |
|------------|--------|------|------|----------------|
| Platform Bulk Operations Framework | Frozen · mandatory | `components/workspace/bulk-operations/` | [`PLATFORM_BULK_OPERATIONS_FRAMEWORK.md`](./PLATFORM_BULK_OPERATIONS_FRAMEWORK.md) | All register multi-select work |
| **Enterprise Document Lifecycle Engine** | **Maintenance Mode · frozen · protected · mandatory** | `lib/document-lifecycle/` | [`ENTERPRISE_DOCUMENT_LIFECYCLE.md`](./ENTERPRISE_DOCUMENT_LIFECYCLE.md) | Document state transitions only |
| **Enterprise Change Impact Engine** | **Maintenance Mode · frozen · protected · mandatory** | `lib/change-impact/` | [`ENTERPRISE_CHANGE_IMPACT_ENGINE.md`](./ENTERPRISE_CHANGE_IMPACT_ENGINE.md) · [`ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md`](./ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md) | Every business-change interpretation |
| **Enterprise Creator Intelligence** | **ACTIVE** (not frozen) · Sprint 1 Historical = protected baseline | `lib/enterprise-creator-intelligence/` | [`ENTERPRISE_CREATOR_INTELLIGENCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE.md) | Planning · Client · Reporting · AI hooks · Mobile |

---

## Maintenance Mode (Document & Change Impact)

After freeze tip `449fd5c0` on `origin/develop`, both engines are in **Maintenance Mode**:

- Defect / type / build fixes allowed  
- No redesign of responsibility boundaries  
- No parallel impact interpreters or document state machines  
- Quotation · Purchase Orders · Invoices · Contracts · Reports · Approval documents **must extend** these engines — never invent new ones  
- **No Production deploy** of related schema without explicit approval  
- Initiative **Enterprise Document & Change Impact** is **CLOSED permanently**

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

- Freeze tip: `449fd5c0` (`origin/develop`) · owner map fix after acceptance `2be8c2b1`  
- Acceptance: [`ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md`](./ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md)  
- Production DB changes require explicit approval (Development-first)

---

## Enterprise Document Lifecycle Engine (protected)

### Responsibility

Document state transitions and available actions from document state only (`resolveDocumentLifecycle`). Reason codes on transitions. No business-impact interpretation.

### Extension rules

1. New document kinds plug into `resolveDocumentLifecycle` + policies.  
2. Business changes that invalidate documents must go through Change Impact first.  
3. Never delete audit history (Cancelled / Superseded remain).

---

## Enterprise Creator Intelligence (ACTIVE — Release 2.3 Phase 1)

**Capability status: ACTIVE — do not freeze.**  
Only Sprint 1 Historical is a **protected implementation baseline** for later sprints to extend.

### Responsibility

Platform creator time-series and intelligence for Planning Workspace, Client Workspace, Reporting Hub, AI Copilot (hooks only), and Mobile. **Not** a Discovery feature.

### Sprint 1 — Historical Creator Intelligence (protected baseline)

| Item | Detail |
|------|--------|
| Raw captures | Append-only → `influencer_metrics_history` |
| Monthly projection | `creator_intelligence_monthly_metrics` |
| Entry points | `appendCreatorMetricsCapture` / `loadCreatorMonthlyMetrics` |
| Capture wiring | IPL `persistSnapshot` when `influencerId` present |
| AI | Hints only (`buildHistoricalAiHints`) — **no AI execution** |
| Migration | `20260802120000_enterprise_creator_intelligence_historical.sql` (Dev applied) |
| Baseline rule | Later sprints must not redesign Sprint 1 capture/rollup/metric definitions |

### Extension rules

1. Reuse IPL + metrics history — do not duplicate calculation engines.  
2. Commercial / category / brand / campaign / investment score → later sprints in this package only.  
3. Creator business changes that affect issued documents → Change Impact → Document Lifecycle.  
4. Bulk refresh/backfill → Platform Bulk Operations Framework.  
5. Money (Sprint 2+) → Financial Display Standard.  
6. No Production deploy without explicit approval.  
7. Parent capability stays **ACTIVE** until Product freezes it after Phase 1 completion.

### Spec

[`ENTERPRISE_CREATOR_INTELLIGENCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE.md)
