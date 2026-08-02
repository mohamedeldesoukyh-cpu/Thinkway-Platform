# Enterprise Document Lifecycle Engine

**Status:** Official platform foundation — **canonical**  
**Release:** 2.2d.2 (2026-08-02)  
**Code:** `lib/document-lifecycle/`  
**Migrations (Development first):**  
- `20260802010000_enterprise_document_lifecycle_enums.sql`  
- `20260802011000_enterprise_document_lifecycle_engine.sql`  
**Regression:** `npm run test:document-lifecycle`  
**Related:** Platform Bulk Operations Framework · Campaign Workspace Baseline v1.3  
**Above this layer:** [`ENTERPRISE_CHANGE_IMPACT_ENGINE.md`](./ENTERPRISE_CHANGE_IMPACT_ENGINE.md) — interprets business changes, severity, recommendations, and feeds Decision Center / Notifications / Timeline / AI.

---

## Purpose

Business documents are **living objects**. They react to business changes with reason codes, never silently mutate after issuance, and never destroy audit history.

**Scope boundary:** Document Lifecycle owns **document state transitions only**. Business interpretation (why / severity / next actions / Decision Center) belongs to the Change Impact Engine.

One engine for:

| Document type | Engine status |
|---------------|---------------|
| Vendor IO | **First production consumer** |
| Client IO | Policy + campaign-cancel / revision reactions |
| Quotations · POs · Invoices · Contracts · Deliverables · Reports · Approval docs | Stub policies ready to adopt |

---

## Non-negotiable separations

| Layer | Owns |
|-------|------|
| **Business State** | Campaign stage / running / cancelled (Lifecycle OS) |
| **Document State** | Draft · Sent · Accepted · Revision Required · Superseded · Cancelled · … |
| **Bulk Framework** | Execute all · skip invalid · one refresh · idempotent |

A campaign can be **Running** while a Vendor IO is **Revision Required** and an Invoice is **Paid**. Do not conflate them.

---

## Approved policies (Option D)

1. **Accepted + business change → always Revision Required** (with reason). Never silent mutate. Regenerate creates Version N+1 Draft; prior tip → **Superseded**.  
2. **Campaign cancel** does **not** rewrite Accepted documents. Outstanding execution → **Cancelled**. Accepted remains Accepted (legal history).  
3. **Resend** = same version (not a revision).  
4. **Schema now:** `revision_required` + `cancelled` on Vendor IO; `revision_required` on Client IO.  
5. **Reason codes required** on Revision Required / Cancelled transitions.  
6. **Business Change Events** fan out to many document reactions.  
7. **Superseded** is the history state (no separate Obsolete).  
8. **AI-ready** hints on every resolved lifecycle (`aiHints`) — no AI execution in this release.

---

## Lifecycle matrix (Vendor IO)

| State | Available actions | Bulk Send | Bulk Mark Accepted |
|-------|-------------------|-----------|--------------------|
| Draft | Generate · Preview · Edit · Send · Mark Delivered · Delete | Execute | Skip |
| Pending Send | Preview · Edit · Send · Mark Delivered · Delete | Execute | Skip |
| Sent | View · Download · Resend · Mark Accepted · Upload signed · Payment terms | Skip | Execute |
| Delivered Manually | View · Download · Mark Accepted · Upload signed · Payment terms | Skip | Execute |
| Viewed | View · Download · Resend · Mark Accepted · … | Skip | Execute |
| Accepted | View · Download · Upload signed | Skip | Skip |
| Rejected | View · Regenerate · Preview changes · Send updated | Policy | Skip |
| Revision Required | View · Preview changes · Regenerate · Send updated · Mark Delivered | Skip (use regenerate) | Skip |
| Superseded | View · Download | Skip | Skip |
| Cancelled | View · Download | Skip | Skip |
| Archived | View · Download | Skip | Skip |

### Valid transitions (summary)

```
Draft → Pending Send → Sent / Delivered Manually → Accepted
Any issued (incl. Accepted) + business change → Revision Required
Revision Required → Regenerate → prior Superseded + new Draft → Sent…
Creator removed / campaign cancel (non-Accepted) → Cancelled
Resend stays on same version
```

---

## Reason codes

| Code | Label |
|------|-------|
| `creator_price_changed` | Creator price changed |
| `deliverables_changed` | Deliverables changed |
| `payment_terms_changed` | Payment terms changed |
| `campaign_budget_changed` | Campaign budget changed |
| `creator_removed` | Creator removed from campaign |
| `creator_replaced` | Creator replaced on campaign |
| `campaign_cancelled` | Campaign cancelled |
| `commercial_correction` | Commercial correction |
| `manual_revision` | Manual revision required |
| … | See `lib/document-lifecycle/reason-codes.ts` |

Stored on the document tip (`lifecycle_reason_code` / `lifecycle_reason_detail`) and on `document_lifecycle_reactions`.

---

## Business Change Events

```
Business Event (e.g. creator_price_updated)
  → business_change_events row
  → plan reactions per document type
  → update document tips (Revision Required / Cancelled)
  → document_lifecycle_reactions (+ ai_context)
```

Example fan-out:

| Event | Vendor IO | Client IO | Budget / Finance |
|-------|-----------|-----------|------------------|
| Creator price updated | Revision Required | Revision Required (commercial review) | AI-ready notify (future) |
| Campaign cancelled | Cancel outstanding | Cancel outstanding | Campaign Business State = Cancelled |
| Creator removed | Cancel non-Accepted | — | — |

---

## Action engine contract

```ts
const resolved = resolveDocumentLifecycle(snapshot);
// resolved.lifecycleState
// resolved.availableActions
// resolved.labels.reason
// resolved.aiHints.recommendRegenerate
```

UI and bulk mutators **must** consume this — never hard-code button visibility by status string alone.

---

## Schema (Development)

| Object | Change |
|--------|--------|
| `vendor_io_status` | + `revision_required`, `cancelled` |
| `client_io_status` | + `revision_required` |
| `vendor_ios` / `client_ios` | `lifecycle_reason_*` columns |
| `business_change_events` | New |
| `document_lifecycle_reactions` | New |

**Production migration requires explicit approval.**

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) | Ops robustness across IO / commercial stages; does not redefine stages |
| Stakeholder journeys | Internal Ops · Commercial · Finance · (future Client/Vendor portals) |
| BPN components reused | Campaign Workspace registers; Decision Center unchanged |
| Navigation | No new philosophy |
| Bulk framework | State-aware skips via lifecycle engine |
| Operational effort | Eliminates guessing which actions apply; safe bulk; audit reasons |
| Capability gates | Bulk · Background · AI-ready · Effort · Idempotent |

---

## Next adopters

1. Wire Quotation / Invoice / PO policies to the same `resolveDocumentLifecycle` switch.  
2. Surface Revision Required in Decision Center (read-only briefing — no competing guidance).  
3. AI automation later: consume `aiHints` + `document_lifecycle_reactions.ai_context`.
