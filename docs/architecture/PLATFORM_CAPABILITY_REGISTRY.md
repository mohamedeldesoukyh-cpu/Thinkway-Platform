# Platform Capability Registry

**Status:** Permanent governance registry — **canonical**  
**Updated:** 2026-08-02 — Release 2.3 Phase 1 · Enterprise Creator Intelligence ACTIVE (Sprint 1–4 protected baselines)  
**Parent:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)

Every future enterprise module must **extend** registered capabilities. Parallel engines are forbidden.

---

## Registered capabilities

| Capability | Status | Code | Spec | Mandatory for |
|------------|--------|------|------|----------------|
| Platform Bulk Operations Framework | Frozen · mandatory | `components/workspace/bulk-operations/` | [`PLATFORM_BULK_OPERATIONS_FRAMEWORK.md`](./PLATFORM_BULK_OPERATIONS_FRAMEWORK.md) | All register multi-select work |
| **Enterprise Document Lifecycle Engine** | **Maintenance Mode · frozen · protected · mandatory** | `lib/document-lifecycle/` | [`ENTERPRISE_DOCUMENT_LIFECYCLE.md`](./ENTERPRISE_DOCUMENT_LIFECYCLE.md) | Document state transitions only |
| **Enterprise Change Impact Engine** | **Maintenance Mode · frozen · protected · mandatory** | `lib/change-impact/` | [`ENTERPRISE_CHANGE_IMPACT_ENGINE.md`](./ENTERPRISE_CHANGE_IMPACT_ENGINE.md) · [`ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md`](./ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md) | Every business-change interpretation |
| **Enterprise Creator Intelligence** | **ACTIVE** (not frozen) · Sprint 1–4 protected baselines | `lib/enterprise-creator-intelligence/` | [`ENTERPRISE_CREATOR_INTELLIGENCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE.md) | Planning · Client · Campaign · Reporting · Analytics · AI hooks · Mobile |

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
| Git baseline | `c31da64e` on `origin/develop` |
| Baseline rule | Later sprints must not redesign Sprint 1 capture/rollup/metric definitions |

### Sprint 2 — Commercial Intelligence (protected baseline)

| Item | Detail |
|------|--------|
| Metrics | CPM · CPE · EMV · ROI · views · reach · cost/deliverable · pricing · negotiation · price movement |
| Dashboard model | Standard metric object + trend labels + comparison windows + benchmark slots + explainability |
| Health / readiness | `commercialHealth` · `investmentReadiness` (not Investment Score) |
| History | Append-only → `creator_intelligence_commercial_history` |
| Entry points | `loadCreatorCommercialIntelligence` / `computeCreatorCommercialIntelligence` |
| Reuse | `calculateCpm`/`calculateCpe` · quotation price reference · Sprint 1 monthly views · Financial Display Standard |
| AI | `buildCommercialAiHints` only — **no AI execution** |

### Sprint 3 — Category & Brand Intelligence (protected baseline)

| Item | Detail |
|------|--------|
| Behavioural categories | 30d / 90d / 180d / Lifetime distributions (total 100%) + trends + confidence |
| Content mix | Reels · Stories · Carousel · Images · Video · Short/Long Form |
| Brands / industries | Mentions · sponsored/organic · affinity · industry rollup |
| Behaviour | Content consistency · specialisation · Planning `businessReadiness` |
| History | Append-only → `creator_intelligence_category_brand_history` |
| Entry points | `loadCreatorCategoryBrandIntelligence` / `computeCreatorCategoryBrandIntelligence` |
| Reuse | Taxonomy inference + canonical categories — no second vocabulary |
| AI | `buildCategoryBrandAiHints` only — **no AI execution** |
| Git baseline | `ad861c01` on `origin/develop` |

### Sprint 4 — Performance Intelligence (protected baseline)

| Item | Detail |
|------|--------|
| History windows | 30d / 90d / 180d / Lifetime performance metrics |
| Behaviour | Trends · stability · audience response · publishing effectiveness · reliability |
| Campaign | Thinkway campaign views/reach/engagement/ROI/EMV/completion/delivery |
| Forecast readiness | Trend · stability · seasonality · confidence — **no prediction** |
| History table | Append-only → `creator_intelligence_performance_history` |
| Entry points | `loadCreatorPerformanceIntelligence` / `computeCreatorPerformanceIntelligence` |
| Reuse | Engagement-rate engine · commercial ROI/EMV · Sprint 1 posting frequency |
| AI | `buildPerformanceAiHints` only — **no AI execution** |
| Gate | Do **not** start Sprint 5 until Product explicitly approves |

### Extension rules

1. Reuse IPL + metrics history + campaign commercial/performance loaders + taxonomy inference — do not duplicate calculation engines.  
2. Internal campaign intelligence / investment score → later sprints in this package only.  
3. Creator business changes that affect issued documents → Change Impact → Document Lifecycle.  
4. Bulk refresh/backfill → Platform Bulk Operations Framework.  
5. Money → Financial Display Standard.  
6. No Production deploy without explicit approval.  
7. Parent capability stays **ACTIVE** until Product freezes it after Phase 1 completion.

### Spec

[`ENTERPRISE_CREATOR_INTELLIGENCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE.md)
