# Platform Capability Registry

**Status:** Permanent governance registry — **canonical**  
**Updated:** 2026-08-02 — Release 2.3 Sprint 2 Studio Evolution **FROZEN · Maintenance Mode**; Decision Narrative registered as Enterprise Planning Standard (not a Platform Capability)  
**Parent:** [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md)  
**Studio Product Constitution:** [`STUDIO_CAPABILITY_CONTRACT.md`](./STUDIO_CAPABILITY_CONTRACT.md) — **FROZEN · Maintenance Mode · COMPLETE** (Mission · Success Criteria · Product Promise · capability categories · Golden Rules)  
**Studio Evolution baseline:** Release 2.3 Sprint 2 — **FROZEN · Maintenance Mode · COMPLETE** (Studio × ECI + Product Excellence Pass + Decision Narrative)

Every future enterprise module must **extend** registered capabilities. Parallel engines are forbidden.

---

## Registered capabilities

| Capability | Status | Code | Spec | Mandatory for |
|------------|--------|------|------|----------------|
| Platform Bulk Operations Framework | Frozen · mandatory | `components/workspace/bulk-operations/` | [`PLATFORM_BULK_OPERATIONS_FRAMEWORK.md`](./PLATFORM_BULK_OPERATIONS_FRAMEWORK.md) | All register multi-select work |
| **Enterprise Document Lifecycle Engine** | **Maintenance Mode · frozen · protected · mandatory** | `lib/document-lifecycle/` | [`ENTERPRISE_DOCUMENT_LIFECYCLE.md`](./ENTERPRISE_DOCUMENT_LIFECYCLE.md) | Document state transitions only |
| **Enterprise Change Impact Engine** | **Maintenance Mode · frozen · protected · mandatory** | `lib/change-impact/` | [`ENTERPRISE_CHANGE_IMPACT_ENGINE.md`](./ENTERPRISE_CHANGE_IMPACT_ENGINE.md) · [`ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md`](./ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md) | Every business-change interpretation |
| **Enterprise Creator Intelligence** | **Maintenance Mode · frozen · protected · COMPLETE** | `lib/enterprise-creator-intelligence/` | [`ENTERPRISE_CREATOR_INTELLIGENCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE.md) · [`ENTERPRISE_CREATOR_INTELLIGENCE_ACCEPTANCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE_ACCEPTANCE.md) | Planning · Client · Campaign · Reporting · Analytics · AI hooks · Mobile |
| **Studio Governance** | **Maintenance Mode · frozen · protected · COMPLETE** | `features/campaign-studio/strategy-engine/` · Studio UX | [`STUDIO_CAPABILITY_CONTRACT.md`](./STUDIO_CAPABILITY_CONTRACT.md) · Strategy Engine governance rule | All Studio / Enterprise Planning work |

### Protected planning standards (not Platform Capabilities)

| Standard | Status | Spec | Mandatory reuse intent |
|----------|--------|------|-------------------------|
| **Enterprise Planning Decision Narrative** | **Protected planning standard** — **not** a standalone Platform Capability | [`ENTERPRISE_PLANNING_DECISION_NARRATIVE.md`](./ENTERPRISE_PLANNING_DECISION_NARRATIVE.md) · Studio SSOT `features/campaign-studio/services/eci/recommendation-narrative.ts` | Studio (current) · Campaign Workspace · Client Workspace · Mobile · AI Copilot · Proposal Engine · Presentation Engine |

Do **not** promote Decision Narrative to a Platform Capability without explicit Product approval. Parallel recommendation-narrative engines are forbidden — extend the standard.

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

## Enterprise Creator Intelligence (FROZEN — Maintenance Mode · COMPLETE)

**Capability status: Maintenance Mode · frozen · protected · COMPLETE.**  
**Freeze tip:** `d01f45f3` on `origin/develop`  
Acceptance: [`ENTERPRISE_CREATOR_INTELLIGENCE_ACCEPTANCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE_ACCEPTANCE.md) — all gates **PASS**.  
**Canonical entry:** `loadCreatorIntelligenceBundle` / `loadCreatorIntelligenceBundles`  
**Shared cache:** `createEciFactsCache` — compute once, reuse; never changes calculations.  
**Studio consumer baseline:** Release 2.3 Sprint 2 Studio Evolution — **FROZEN · Maintenance Mode · COMPLETE**. Studio must consume this package only via `loadCreatorIntelligenceBundle`.

### Maintenance Mode

- Defect / type / build / cache-performance fixes allowed  
- No redesign of Sprint 1–6 contracts  
- No parallel creator investment / commercial / audience / performance / category engines  
- Discovery Thinkway Score remains Discovery-only — never Planning investment SSOT  
- No Production deploy without explicit approval  

### Responsibility

Platform creator time-series and intelligence for Studio (Enterprise Planning), Client Workspace, Campaign Workspace, Reporting Hub, Enterprise Analytics, AI Copilot (hooks only), and Mobile. **Not** a Discovery feature.

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
| Git baseline | `54057bd5` on `origin/develop` |

### Sprint 5 — Audience Intelligence (protected baseline)

| Item | Detail |
|------|--------|
| Demographics | Gender · age · country · city · language across analysis windows |
| Growth / quality / stability | Follower growth trends · supported quality only · audience stability |
| Behaviour / geo / language | Engagement behaviour · primary geo · language roles |
| Business readiness | Audience fit · confidence · commercial audience readiness |
| History table | Append-only → `creator_intelligence_audience_history` |
| Entry points | `loadCreatorAudienceIntelligence` / `computeCreatorAudienceIntelligence` |
| Reuse | Influencer demos · Sprint 1 monthly followers · Sprint 4 audience response |
| AI | `buildAudienceAiHints` only — **no AI execution** |
| Git baseline | `51836e97` on `origin/develop` |

### Sprint 6 — Creator Investment Intelligence (protected baseline)

| Item | Detail |
|------|--------|
| Model | Weighted multi-dimensional investment score (13 explainable dimensions) |
| Recommendation | Highly Recommended · Recommended · Consider · High Risk · Insufficient Data + why |
| Confidence / risks / opportunities | Percent + based-on layers · severity/actions · explained opportunities |
| Business readiness | Planning → Client → Campaign → Reporting → Analytics → AI → Mobile |
| History table | Append-only → `creator_intelligence_investment_history` |
| Entry points | `loadCreatorInvestmentIntelligence` / `computeCreatorInvestmentIntelligence` |
| Reuse | Sprint 1–5 intelligence only — map classifications; never recalculate layer engines |
| AI | `buildInvestmentAiHints` only — **no AI execution** |
| Migration | `20260802170000_enterprise_creator_intelligence_investment.sql` (Dev applied) |
| Git baseline | `d4107623` on `origin/develop` |
| Evidence Coverage | First-class on every layer; confidence capped by evidence coverage |
| Platform SSOT | `loadCreatorIntelligenceBundle` — Planning → Mobile |

### Extension rules

1. Reuse IPL + metrics history + campaign commercial/performance loaders + taxonomy inference + demographic columns + layer intelligence — do not duplicate calculation engines.  
2. Platform consumers must call `loadCreatorIntelligenceBundle` — never invent parallel scores.  
3. Creator business changes that affect issued documents → Change Impact → Document Lifecycle.  
4. Bulk refresh/backfill → Platform Bulk Operations Framework + shared ECI cache.  
5. Money → Financial Display Standard.  
6. No Production deploy without explicit approval.  
7. Maintenance Mode — extend with sibling layers; do not redesign Sprint 1–6.  
8. Studio (Enterprise Planning) is the active consumer initiative and must bind to this SSOT via `loadCreatorIntelligenceBundle` only.

---

## Studio Governance (FROZEN — Maintenance Mode · COMPLETE)

**Capability status: Maintenance Mode · frozen · protected · COMPLETE.**  
**Constitution:** [`STUDIO_CAPABILITY_CONTRACT.md`](./STUDIO_CAPABILITY_CONTRACT.md)  
**Code:** `features/campaign-studio/strategy-engine/` (Planning Context orchestration)  
**Rules:** `.cursor/rules/thinkway-studio-capability-contract.mdc` · `.cursor/rules/thinkway-strategy-engine-governance.mdc`

### Protected baseline

- Studio Capability Contract (Mission · Success Criteria · Product Promise · categories · Golden Rules)  
- Strategy Engine Foundation  
- Planning Context Governance (runtime orchestration only — never a persisted business object)

### Maintenance Mode

- Defect / type / build fixes and compliant capability extensions allowed  
- No redesign of Mission, Success Criteria, Product Promise, categories, or Golden Rules  
- No Planning Context table / CRM object / Studio document / saved entity  
- No Studio ownership of Intelligence or Execution capabilities  
- No parallel Planning Workspace product outside Studio  
- Violation → Architecture Reopen + Product approval  

### Studio Evolution — Release 2.3 Sprint 2 (FROZEN · Maintenance Mode · COMPLETE)

**Status:** **FROZEN · Maintenance Mode · protected Studio Evolution baseline · COMPLETE**  
**Product approval:** 2026-08-02  
**Freeze tip:** `7719affc` on `origin/develop`  
**Code:** `features/campaign-studio/services/eci/` · executive planning surfaces · proposal/presentation narrative wiring  
**Standard:** [`ENTERPRISE_PLANNING_DECISION_NARRATIVE.md`](./ENTERPRISE_PLANNING_DECISION_NARRATIVE.md)

#### Protected baseline includes

- Studio consume-only adapter for Enterprise Creator Intelligence (`loadCreatorIntelligenceBundle`)  
- Executive planning views (cards · detail · Strategy Compare · Executive Summary)  
- Decision Impact (“what happens if this decision changes?” — planning explanation only)  
- Enterprise Planning Decision Narrative (Recommendation → Why → Evidence → Business → Commercial → Risk → Alternative → Decision Impact → Confidence)  
- Planning Alternatives (decision transparency — not scenario planning)  
- Proposal / Presentation Creator Strategy Rationale using the same narrative  

#### Maintenance Mode

- Defect / type / build / continuity sync fixes allowed  
- No redesign of Studio, Media Plan ownership, Planning Context, Strategy Engine, or Campaign Workspace  
- No ECI architecture changes; no parallel intelligence  
- No further Sprint 2 enhancements in this release  
- Elevating Decision Narrative to a Platform Capability requires Product approval  

### Spec

[`ENTERPRISE_CREATOR_INTELLIGENCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE.md) · [`STUDIO_CAPABILITY_CONTRACT.md`](./STUDIO_CAPABILITY_CONTRACT.md) · [`ENTERPRISE_PLANNING_DECISION_NARRATIVE.md`](./ENTERPRISE_PLANNING_DECISION_NARRATIVE.md)
