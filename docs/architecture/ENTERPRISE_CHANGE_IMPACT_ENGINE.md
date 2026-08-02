# Enterprise Change Impact Engine

**Status:** Official platform capability — **FROZEN · PROTECTED · MANDATORY · MAINTENANCE MODE**  
**Initiative:** Enterprise Document & Change Impact — **CLOSED permanently**  
**Release:** 2.2d.2b (2026-08-02)  
**Freeze tip:** `449fd5c0` on `origin/develop`  
**Acceptance:** [`ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md`](./ENTERPRISE_CHANGE_IMPACT_ACCEPTANCE.md)  
**Registry:** [`PLATFORM_CAPABILITY_REGISTRY.md`](./PLATFORM_CAPABILITY_REGISTRY.md)  
**Code:** `lib/change-impact/`  
**Migration (Development):** `20260802020000_enterprise_change_impact_engine.sql`  
**Regression:** `npm run test:change-impact`  
**Companion:** [`ENTERPRISE_DOCUMENT_LIFECYCLE.md`](./ENTERPRISE_DOCUMENT_LIFECYCLE.md)  

## Maintenance Mode

Defect fixes only. No redesign. Future Quotation · PO · Invoice · Contract · Report work **must extend** this engine — never create parallel impact logic. **No Production deploy** without explicit approval.  

---

## Purpose

The Change Impact Engine is the **intelligence layer** above Document Lifecycle.

| Engine | Responsibility |
|--------|----------------|
| **Change Impact** | Interpret business changes · affected objects · impacted documents · severity · business explanation · owned recommended actions · Decision Center / Notifications / Timeline / AI-ready feeds |
| **Document Lifecycle** | Document state transitions only |

**Do not** expand Quotation · PO · Invoice · Contract · other document types until they **extend this engine**.

---

## Canonical entry (SSOT)

```ts
import { applyBusinessChangeImpact } from "@/lib/change-impact";
// alias: assessAndApplyBusinessChange
```

There is **one** impact engine. `emitBusinessChangeEvent` is a compatibility shim that delegates here.

---

## Flow

```
Business Change Event
        ↓
applyBusinessChangeImpact  ← only entry
        ↓
Plan document reactions (Document Lifecycle — plan)
        ↓
Assess impact (severity · explainability · owner · recommendations · AI)
        ↓
Persist identical assessment
        ↓
Feeds (same data): Decision Center · Timeline · Notifications · AI
        ↓
Apply document state transitions (Document Lifecycle — apply)
```

---

## Severity (product labels)

| Storage | Label |
|---------|-------|
| critical | Critical |
| high | Major |
| medium | Moderate |
| low | Minor |
| info | Informational |

Exactly one level per assessment. Reused by Decision Center, Notifications, AI, Reporting, Mobile.

---

## Explainability (mandatory)

Every assessment answers:

1. What changed?  
2. Why is it important?  
3. What was affected?  
4. What should happen next?  
5. Who owns the action?  

---

## Event coverage

See acceptance matrix. Supported event types produce deterministic assessments. Unsupported campaign events are **backlog** — wire through this engine only.

---

## Future compatibility (no redesign)

Planning Workspace · Client Workspace · Vendor/Creator portals · Reporting Hub · Enterprise Analytics · AI Copilot · Mobile — consume assessment projections / tables.

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Lifecycle OS | Not redesigned — consumes impact signals as Decision Center items |
| BPN / navigation | Unchanged |
| Document Lifecycle | State transitions only |
| Gates | Bulk · Background · AI-ready · Effort · Idempotent |
