# Release 2.1 — Implementation Package

**Status:** Implemented on `develop` (pending Dev soak → Preview → UAT → Production approval)  
**Parent:** [`ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`](./ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md)  
**Validation:** [`RELEASE_2_1_ARCHITECTURE_VALIDATION.md`](./RELEASE_2_1_ARCHITECTURE_VALIDATION.md) (**APPROVED**)

---

## 1. Technical Design Summary

Release 2.1 hardens operational joins without redesign:

| Concern | Design |
|---|---|
| Assignment backbone | `campaign_lines.id` carried on Media Plan slots, engine items, performance facts, slate |
| Planned ↔ Actual | ID-first match: Post → Deliverable → Assignment; legacy creator/label only when no Assignment ID |
| Multi Media Plan | Multiple `campaign_objects` per header + `meta.mediaPlanIdentity`; header `campaign_object_id` remains default |
| Timeline | Single spine `audit_logs` + Enterprise Timeline contract metadata |
| Grain guards | Block schedule moves for live / locked / billing-locked Assignment grains |
| Commercial / Finance | Untouched |

No new Assignment, Media Plan, or Timeline tables.

---

## 2. Database changes

**None required for R2.1 core path.**

- Assignment refs live in existing JSON (`meta.mediaPlanSchedule.assignments[]`, calendar day fields, engine items).
- Multi-plan classification: `campaign_objects.meta.mediaPlanIdentity` (JSON).
- Timeline: normalized metadata on existing `audit_logs`.

Optional future (not in this slice): nullable header collection column — deferred; listing queries by `campaign_header_id`.

---

## 3. Service changes

| Area | Change |
|---|---|
| `lib/media-plan/operational-refs.ts` | Match-key helper |
| `lib/media-plan/performance-facts.ts` | Emit Assignment / Deliverable / Post IDs + lock flags |
| `lib/media-plan/projections.ts` | ID-first Actual / Remaining |
| `lib/media-plan/annotate-execution-status.ts` | Assignment-aware card overlay |
| `lib/media-plan/grain-lock-guards.ts` | Mutation integrity guards |
| `lib/media-plan/stamp-assignment-refs.ts` | Stamp IDs onto cached calendars |
| `lib/media-plan/log-media-plan-timeline.ts` | Enterprise contract metadata |
| `lib/timeline/*` | Event contract + emitter |
| Hydration | Seed + bind Assignment refs onto slate |
| `list-campaign-media-plans.ts` | Multi-plan discovery |
| `load-campaign-media-plan.ts` | Plan selector + ID stamping |

**Untouched:** Convert, Commercial SSOT, Client IO, Vendor IO, Invoice, Billing, Payment, Commercial Revision OS.

---

## 4. API changes

- No new public REST mutation APIs.
- Existing server action `updateMediaPlanScheduleAction` now enforces grain guards.
- Campaign Media Plan page accepts `?planId=` (optional) alongside `?view=`.

---

## 5. UI changes

- Campaign Media Plan workspace: plan selector when multiple plans exist; default remains header pointer.
- Campaign Timeline tab label: “Enterprise Timeline” (still backed by `audit_logs` / workspace activity).
- Calendar cards / exports: Assignment IDs carried in data model (display unchanged).

---

## 6. Timeline contract

Canonical doc types: `lib/timeline/enterprise-timeline-contract.ts`

- Source: `enterprise_timeline` (Media Plan also records `source_engine: media_plan_engine`)
- Required metadata: `event`, `label`, `summary`, `campaign_header_id`
- Assignment-aware: `campaign_line_id`, optional deliverable/post IDs
- Emitter: `emitEnterpriseTimelineEvent` → `insertAuditLog`

Finance events (`invoice.issued`, `payment.received`) are defined in the contract for later releases; not required emitters in 2.1.

---

## 7. Assignment relationship validation

Automated (`npm run test:release-2-1`):

- Seed carries `campaignLineId` / deliverable / post IDs
- Bind stamps IDs onto existing slate
- Performance facts emit IDs
- Actual/Remaining match by Assignment/Post ID (not shared creator label)
- Grain guard blocks live/billing-locked moves
- Timeline contract mapping

---

## 8–9. Automated / regression tests

```bash
npm run test:release-2-1
npm run test:media-plan-phase1
npm run test:media-plan-phase3
```

Commercial SSOT / Convert / Deliverables docs suites remain regression gates before Production (unchanged code paths).

---

## 10. UAT checklist

See [`RELEASE_2_1_UAT.md`](./RELEASE_2_1_UAT.md).

---

## 11. Production rollout plan

1. Merge to `develop` → auto Dev deploy  
2. Dev soak: Media Plan Original/Actual/Remaining + multi-plan selector + Timeline events  
3. Preview verification  
4. Architecture re-check (no Commercial/Finance drift)  
5. Feature freeze for R2.1 defects only  
6. **Explicit Production approval** required before `main` / prod deploy  
7. Production smoke: single-plan campaigns unchanged; Assignment-linked Actual matching; Timeline feed  

**DB:** no Production migration required for this slice.

---

## 12. Rollback plan

| Layer | Action |
|---|---|
| Code | Revert deploy commit |
| JSON Assignment fields | Additive — old readers ignore |
| Timeline metadata | Additive — UI falls back to summary |
| Commercial / Finance | Untouched — no rollback surface |

Never recreate Assignment IDs as part of rollback.
