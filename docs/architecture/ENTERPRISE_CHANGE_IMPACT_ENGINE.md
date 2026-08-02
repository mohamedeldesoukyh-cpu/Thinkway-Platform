# Enterprise Change Impact Engine

**Status:** Official platform foundation — **canonical**  
**Release:** 2.2d.2b (2026-08-02)  
**Code:** `lib/change-impact/`  
**Migration (Development first):** `20260802020000_enterprise_change_impact_engine.sql`  
**Regression:** `npm run test:change-impact`  
**Companion:** [`ENTERPRISE_DOCUMENT_LIFECYCLE.md`](./ENTERPRISE_DOCUMENT_LIFECYCLE.md)  

---

## Purpose

The Change Impact Engine is the **intelligence layer** above Document Lifecycle.

| Engine | Responsibility |
|--------|----------------|
| **Change Impact** | Interpret business changes · affected objects · impacted documents · severity · business explanation · recommended actions · Decision Center / Notifications / Timeline / AI-ready feeds |
| **Document Lifecycle** | Document state transitions only (Revision Required, Cancelled, Superseded, …) |

**Do not** expand Quotation · PO · Invoice · Contract · other document types until this engine is approved as complete.

---

## Flow

```
Business Change Event
        ↓
Change Impact Engine.assess / apply
        ↓
Affected business objects
Impacted documents
Severity + business explanation
Recommended actions
AI-ready recommendation payload
        ↓
Persist assessment + intents
        ↓
Feeds:
  · Decision Center (open assessments → blockers)
  · Notifications (pending intents)
  · Timeline (enterprise audit event)
  · Future AI Recommendations (ai_context)
        ↓
Document Lifecycle apply (state transitions only)
```

---

## Severity model

| Severity | Meaning | Decision Center mapping |
|----------|---------|-------------------------|
| `critical` | Campaign-level stop / cancel cascade | `business_blocker` |
| `high` | Accepted/issued docs invalidated | `operational_attention` |
| `medium` | Issued docs need revision | `operational_attention` |
| `low` | Minor follow-up | `optimization` |
| `info` | Recorded, no document action | `optimization` |

Business State (campaign running/cancelled) remains separate from Document State.

---

## Entry point

```ts
import { applyBusinessChangeImpact } from "@/lib/change-impact";

const result = await applyBusinessChangeImpact(supabase, {
  eventType: "creator_price_updated",
  reasonCode: "creator_price_changed",
  reasonDetail: "Creator price changed after document issuance.",
  campaignHeaderId,
  campaignLineIds: [lineId],
  estimatedImpact: { amountDelta: 12500, currencyCode: "EGP" },
  actorId,
});
```

Preview without writes: `assessBusinessChangeImpact(input, plannedReactions)`.

---

## Persistence

| Table | Role |
|-------|------|
| `change_impact_assessments` | One assessment per business change |
| `change_impact_affected_objects` | Campaign / line / creator / documents |
| `change_impact_document_impacts` | Per-document explanation + planned status |
| `change_impact_notification_intents` | Pending notification feed |

---

## Feeds

| Feed | Implementation |
|------|----------------|
| Decision Center | `loadOpenChangeImpactSignals` → workspace → `changeImpactSignalsToDecisionBlockers` |
| Notifications | `change_impact_notification_intents` (`pending`) + list/mark helpers |
| Timeline | `feedChangeImpactTimeline` → `emitEnterpriseTimelineEvent` |
| AI Recommendations | `ai_context` / `projectChangeImpactAiRecommendation` — **no AI execution** |

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Lifecycle OS | Not redesigned — Decision Center consumes impact signals as inbox items |
| BPN / navigation | Unchanged |
| Document Lifecycle | Remains state-transition engine only |
| Bulk framework | Recommended actions may include bulk regenerate (AI-ready) |
| Gates | Bulk · Background · AI-ready · Effort · Idempotent |

---

## Approval gate

**Before** implementing Quotation / PO / Invoice / Contract / Deliverable / Report document lifecycle policies:

1. Confirm Change Impact assessments appear in Decision Center for price-change and cancel events.  
2. Confirm Timeline + notification intents are written.  
3. Confirm Document Lifecycle still owns only status transitions.  

Then approve expansion of document types onto the Document Lifecycle engine, always routed through Change Impact for business changes.
