# Release 2.1 — Architecture Validation Report

**Release:** 2.1 — Media Plan ↔ Assignment Hardening  
**Parent package:** [`ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`](./ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md) (**APPROVED & FROZEN**)  
**Status:** **APPROVED** (Product 2026-07-30) · Implementation package: [`RELEASE_2_1_IMPLEMENTATION.md`](./RELEASE_2_1_IMPLEMENTATION.md)  
**Date:** 2026-07-30  
**Branch baseline:** `develop`

---

## 0. Executive verdict

Thinkway already has the correct ERP spine:

```
Campaign Header → Campaign Line (Assignment) → Deliverable → Post Schedule
                      ↓
              campaign_objects (Media Plan)
                      ↓
                   audit_logs (Timeline spine)
```

Release 2.1 is **not** a redesign. It is a hardening pass to:

1. Make **Assignment (`campaign_lines.id`)** the stable operational join key for Media Plan, Planned↔Actual, Reporting, and Timeline.
2. Support **multiple Media Plans per Campaign** without inventing a parallel ledger.
3. Publish a **consistent Enterprise Timeline event contract** on the existing `audit_logs` spine.
4. Leave **Commercial SSOT, Convert, Finance (CIO/VIO/Invoice/Billing/Payment/Revision OS)** untouched.

**Recommendation:** Approve a **minimal-change** implementation plan (extend schedule JSON + loaders + ID-first projections + multi-plan collection pointer + timeline event contract). Do **not** create new Assignment/Media Plan/Timeline tables.

---

## 1. Current Architecture

### 1.1 Database (tables involved)

| Domain | Table | PK | Key relationships | Notes |
|---|---|---|---|---|
| Campaign | `campaign_headers` | `id` | → `brands`; optional `quotation_id`, `accepted_quotation_id`, `campaign_object_id`, `shortlist_id` | Single Media Plan pointer today (`campaign_object_id`) |
| Assignment | `campaign_lines` | `id` | → `campaign_header_id`; optional `source_quotation_item_id` (CML), `vendor_io_id`, `invoice_id` | **Operational Assignment identity** |
| Vendor link | `campaign_influencers` | `id` | → `influencer_id`; nullable `campaign_header_id`, `campaign_line_id`; legacy required `campaign_id` | Bridge / package members; not the Assignment root |
| Deliverables (ops) | `assignment_deliverables` | `id` | → `campaign_line_id`, `campaign_header_id` | Operational deliverable grain |
| Posts | `assignment_post_schedule` | `id` | → `assignment_deliverable_id`, `campaign_line_id` | Publication schedule grain |
| Commercial Snapshot | `campaign_commercial_snapshots` | `id` | → `campaign_header_id`, `quotation_id` | Append-only; **out of R2.1 write scope** |
| Media Plan head | `campaign_objects` | `id` | optional `campaign_header_id`; unique `conversation_id` | Media Plan identity |
| Media Plan versions | `campaign_object_versions` | `(campaign_object_id, version)` | snapshot `jsonb` | Technical immutability |
| Docs repo | `deliverable_assets` (+ versions/comments/events/links) | — | → `assignment_deliverable_id` | Documentation only; preserve |
| Legacy deliverables | `deliverables` | `id` | `campaign_id` / influencer / optional `campaign_influencer_id` | Compatibility path; not SSOT |
| Audit / Timeline | `audit_logs` | `id` | entity_type + entity_id + metadata | Canonical event store |
| Specialized events | `deliverable_documentation_events`, `vendor_payment_timeline_events`, `commercial_revisions`, `quotation_revisions` | — | domain-specific | Must project into Timeline later; not replace `audit_logs` |

**Nullable / temporary / legacy relationships (critical):**

| Relationship | Today | Risk |
|---|---|---|
| Media Plan slot → Assignment | **Missing** — slot stores `creatorId` + optional `serviceType` only | Label/creator matching for Actual/Remaining |
| Media Plan → Campaign | Bidirectional but **singular**: `campaign_headers.campaign_object_id` | Blocks true multi-plan UX |
| `campaign_influencers.campaign_line_id` | Nullable (legacy rows) | Weak package/member joins |
| `campaign_influencers.campaign_id` | Legacy required | Parallel identity to header |
| Performance facts → Assignment | Uses `influencer_id` or falls back to `campaign_lines.id` as `creatorId` | Identity ambiguity |
| Unlocked deliverable sync | Can delete/recreate child deliverable/post IDs | Child IDs not durable enough for exclusive joins |

### 1.2 Media Plan schedule model (current)

`meta.mediaPlanSchedule.assignments[]` (`features/campaign-outputs/media-plan-schedule.ts`):

```ts
{ creatorId, week, dayIndex, serviceType? }
```

**Confirmed gap:** no `campaignLineId` / `assignmentDeliverableId` / `assignmentPostScheduleId` anywhere under `lib/media-plan` or `features/campaign-outputs` schedule types.

Engine item match key today (`lib/media-plan/calendar-adapter.ts` / projections):

```
creatorId + platform + deliverable label
```

### 1.3 Services (reuse map)

| Area | Canonical services (KEEP) | Status |
|---|---|---|
| Convert | `lib/services/campaigns/convert-quotation-to-assignments.ts` | Production; **do not redesign** |
| Assignment factory | `createCampaignLine` + deliverable sync | Production |
| Assignment hierarchy | `features/campaigns/queries/assignment-hierarchy.ts` | Reuse for seeding + facts |
| Media Plan engine | `lib/media-plan/*` | Production v1; extend |
| Media Plan mutations | `features/campaign-outputs/media-plan-mutations.ts` | Lock/approve/draft fork exists |
| Media Plan persistence | `features/campaign-intelligence/services/campaign-object-persistence.ts` | Reuse |
| Lifecycle → audit | `lib/media-plan/log-media-plan-timeline.ts` | Already writes `audit_logs` |
| Hydration | `features/campaign-outputs/hydration/seed-from-assignment-hierarchy.ts` | Seeds slate; **drops Assignment IDs** today |
| Performance facts | `lib/media-plan/performance-facts.ts` | Label-based; harden to IDs |
| Commercial SSOT | commercial services / snapshots | **DO NOT TOUCH** |
| Finance (CIO/VIO/Invoice) | billing / vendor IO services | **OUT OF SCOPE R2.1** |
| Documentation | `lib/services/deliverables/documentation-service.ts` | Preserve boundary |

### 1.4 UI (current data flow)

```
Studio (generate/regenerate)
  → campaign_objects snapshot (media plan schedule + lifecycle)
  → optional link to campaign_headers.campaign_object_id

Campaign workspace → /campaigns/[id]/media-plan
  → load single plan via header.campaign_object_id
  → Original / Actual / Remaining + approval/history

Client portal Media Plan
  → same single object pointer; approve / request changes / reject

Campaign Timeline & activity tab
  → finance audit + generic workspace activity + recent assignments
  → Media Plan events already land in audit_logs, but UI is not a unified enterprise spine yet
```

Sidebar: Campaigns / Studio / Reports — no top-level Media Plan or Deliverables nav (by design; campaign-scoped).

### 1.5 APIs (current)

| Surface | Path / mechanism | Reuse |
|---|---|---|
| Generate / save schedule | Server actions (`generate-outputs-action`, `update-media-plan-schedule`, lifecycle actions) | Prefer extend over new REST |
| Export | `GET /api/ai/campaign-objects/[id]/outputs/export` | Keep |
| Lifecycle API | `POST /api/ai/campaign-objects/[id]/lifecycle` | Keep |
| Legacy proposal export | `/api/ai/campaign-objects/[id]/export` | Distinct; leave |
| Publications bundle | `/api/campaigns/[id]/publications-bundle` | Reporting join target later |
| Performance document | `/api/campaigns/[id]/performance/document` | Strengthen joins only |

**No dedicated public Media Plan mutation REST API** — server actions are the write path. Minimise new APIs.

### 1.6 Permissions (current)

| Role surface | How gated today |
|---|---|
| Campaigns | `campaigns.read` / `campaigns.write` + `can_access_campaign_header` RLS |
| Media Plan Studio/export | `ai.read` / `ai.write` (no separate `media_plan.*`) |
| Publications | Catalogue has `publications.*`; many routes use `campaigns.read` |
| Commercial | Commercial / Finance permissions — **unchanged in R2.1** |
| Client portal | Portal-scoped Media Plan approve/reject actions |

R2.1 should **reuse** existing campaign/AI permissions; introduce a dedicated `media_plan.*` permission only if Product explicitly requires separation (not recommended for this release).

### 1.7 Audit / Timeline (current)

- **Canonical store:** `audit_logs`
- Media Plan lifecycle already projects events via `logMediaPlanTimelineEvents` (created/draft/locked/approved/rejected/regenerated/baseline).
- Convert emits `quotation.converted_to_assignments`.
- Commercial sync writes commercial audit rows.
- Specialized stores exist for documentation / payments / revisions — **project into Timeline; do not duplicate**.
- Campaign Timeline UI exists but is a **split panel** (finance / activity / assignments), not yet the Enterprise Timeline contract from architecture §8.4.

---

## 2. Gap Analysis (vs Release 2.1 success criteria)

| # | Success criterion | Current | Gap severity |
|---|---|---|---|
| G1 | Assignment is operational backbone for Media Plan slots | Slots use `creatorId` + label | **Critical** |
| G2 | Planned↔Actual uses stable Assignment refs | Label match + soft creator match | **Critical** |
| G3 | Multiple Media Plans per Campaign | Schema allows many objects; UI/header pointer is singular | **High** |
| G4 | Assignment IDs preserved; no unnecessary recreation | Line IDs stable; unlocked children can be recreated | **Medium** (constrain joins) |
| G5 | Enterprise Timeline event contract | Partial Media Plan + convert; fragmented UI | **High** |
| G6 | Reporting Assignment-centric | Billing/VIO strong; analytics/Media Plan weak | **Medium** |
| G7 | Commercial SSOT untouched | Intact | **None (preserve)** |
| G8 | Finance untouched | Intact | **None (preserve)** |
| G9 | Approval / lock / history for Media Plan | Largely implemented at plan level | **Low** (add grain guards) |
| G10 | Non-live / billing-lock guards on slot mutation | Documented intent; not enforced on Assignment grain | **Medium** |
| G11 | No parallel history systems | Multiple history *layers* (technical/business/edit/audit) — intentional for Media Plan | **Govern, don’t merge tables** |

---

## 3. Reuse Opportunities (mandatory)

1. **Assignment entity** = existing `campaign_lines` — never create `assignments` table.
2. **Media Plan identity** = existing `campaign_objects` + `campaign_object_versions`.
3. **Lifecycle / approve / lock / draft fork** = existing `media-plan-mutations` + `mediaPlanLifecycle` meta.
4. **Timeline spine** = existing `audit_logs` + `logMediaPlanTimelineEvents` pattern.
5. **Hierarchy query** = `getCampaignAssignmentHierarchy()` for seed + performance facts.
6. **Hydration path** = extend `seed-from-assignment-hierarchy` to **carry IDs**, not replace it.
7. **Projections** = replace `itemMatchKey()` with ID-first match; keep label match as flagged legacy fallback only.
8. **Permissions** = `campaigns.*` + `ai.*` + existing RLS helpers.
9. **Convert / Commercial Snapshot / Documentation Repo** = reuse as-is; no redesign.

---

## 4. Technical Debt (in scope to reduce; not to expand)

| Debt | Location | R2.1 stance |
|---|---|---|
| Creator/label join for Actual/Remaining | `projections.ts`, `annotate-execution-status.ts`, `performance-facts.ts` | **Eliminate as authority**; keep fallback only |
| Hydration drops Assignment IDs | `seed-from-assignment-hierarchy.ts` | **Fix** |
| Singular `campaign_headers.campaign_object_id` | header + loaders | **Extend** for multi-plan collection |
| Legacy `deliverables` still written | `campaign-line-service` soft-fail path | **Do not expand**; leave compatibility |
| `campaign_influencers` dual campaign keys | legacy `campaign_id` | **Do not migrate in 2.1** unless required for joins |
| Unlocked deliverable/post ID churn | `sync-commercial-rows` | Prefer Assignment (+ CML) as durable join; optional durable child refs when present |
| Timeline UI fragmentation | `campaign-timeline-tab.tsx` | Contract first; UI consolidation minimal |
| Entity type singular/plural mismatch in audit queries | producers vs workspace loaders | Normalize event contract |

---

## 5. Impact Assessments (planning only)

### 5.1 Database Impact

**Preferred minimal model (recommended):**

1. **No new tables** for Media Plan or Assignment.
2. Extend `meta.mediaPlanSchedule.assignments[]` (and rendered/engine types) with optional durable refs:
   - `campaignLineId` (required for new/edited slots)
   - `assignmentDeliverableId?`
   - `assignmentPostScheduleId?`
3. Multi-plan: keep multiple `campaign_objects.campaign_header_id`; add a **collection pointer** strategy:
   - Option A (preferred): header retains `campaign_object_id` as *primary/default*; add ordered list in header metadata or small join table only if listing cannot be done by query.
   - Option B: query all `campaign_objects` by `campaign_header_id` + plan classification in object meta (`planKind` / platform / country / phase).
4. Timeline: **no new timeline table** — event type + Assignment IDs in `audit_logs.metadata`.
5. Migration: optional backfill script to attach `campaignLineId` to existing slots by creator+deliverable match where unambiguous; leave ambiguous slots for manual repair / legacy fallback.

**Avoid:** new `media_plans`, `assignment_timeline_events`, commercial columns, finance FKs.

### 5.2 Service Impact

| Service | Change |
|---|---|
| `media-plan-schedule` / mutations | Carry Assignment refs; reject mutation when grain locked/live/invoiced (where detectable) |
| `seed-from-assignment-hierarchy` | Emit IDs onto slate/slots |
| `performance-facts` / `projections` / annotate | ID-first reconciliation |
| `link-campaign-media-plan` + loaders | Multi-plan list + default plan |
| `log-media-plan-timeline` + new thin emitters | Assignment lifecycle events into `audit_logs` |
| Convert / Commercial / Billing | **No changes** |

### 5.3 API Impact

- Prefer **server action extensions**; avoid new public REST unless Timeline needs a read projection endpoint.
- Optional: `GET` campaign timeline projection (read-only) if UI needs pagination — only if existing workspace loaders cannot be extended.
- Export routes unchanged in contract; may include Assignment IDs in embedded data if already rendered.

### 5.4 UI Impact

- Campaign Media Plan workspace: multi-plan list/selector; keep existing calendar/approval UX.
- Studio: generate/regenerate continues; seed with Assignment-linked slots.
- Timeline tab: consume normalized event contract (incremental); do not redesign Campaign workspace.
- Portal: remain single-plan-safe (default/primary plan) unless Product expands portal multi-plan later.

### 5.5 Permission Impact

- No new roles.
- Reuse `campaigns.read/write`, `ai.read/write`, portal client actions.
- Ensure Timeline read uses `campaigns.read` + header access.

### 5.6 Timeline Impact

Enterprise Timeline **event contract** (publish via `audit_logs`, Assignment-aware metadata):

| Event | Module | Assignment ref |
|---|---|---|
| Campaign Created | Campaign | n/a (header) |
| Assignment Created / Updated | Assignment | `campaign_line_id` |
| Media Plan Approved / Locked / Regenerated / Revised | Media Plan | optional affected line IDs |
| Deliverable Submitted | Docs / Deliverables | line + deliverable |
| Publication Verified | Performance | line + post |
| Performance Updated | Performance | line |
| Commercial Revision | Commercial (emit only if already exists; **no new revision OS**) | CML + lines |
| Invoice / Payment | Finance | **defer emit completeness to 2.2/2.3/3.0** if not already logged |

**Rule:** One spine (`audit_logs` + projections). No second history product.

### 5.7 Reporting Impact

- Strengthen joins to `campaign_line_id` for Media Plan Actual/Remaining and campaign performance overlays.
- Do **not** rebuild P&L / dashboard / commercial reports.
- Leave finance reporting for later releases.

---

## 6. Test Strategy

Automated coverage (extend existing suites; add focused files):

| Suite | Covers |
|---|---|
| Assignment relationships | Slot carries `campaignLineId`; hydration preserves line IDs |
| Media Plan relationships | Multi-plan list; default pointer; version lock/approve regression |
| Timeline | Event writers emit required metadata keys; no duplicate stores |
| Reporting joins | ID-first Actual/Remaining; ambiguous legacy fallback flagged |
| Campaign conversion | Existing convert tests — **regression only** |
| Commercial SSOT | Existing `test:commercial-ssot-*` — **regression only** |
| Deliverables | Docs repo + normalized deliverables — **regression only** |
| Navigation | Media Plan route + campaign workspace entry still resolve |
| Performance | Annotate execution status prefers IDs |

Suggested commands (post-impl): existing media-plan / campaign-outputs tests + targeted new vitest files; Discovery UI contract unchanged (out of scope).

---

## 7. UAT Plan (prepare after impl)

| Case | Expect |
|---|---|
| Single Media Plan | Existing Prod behaviour preserved |
| Multiple Media Plans | Create/list/select per campaign; each one Campaign only |
| Assignment replacement | Plan slots rebind or flag orphan; no silent wrong Actual |
| Assignment updates | Line ID stable; calendar display updates without new Assignment IDs |
| Versioning | Draft fork / approve / lock unchanged |
| Approval | Portal + internal approval still work |
| Locking | Approved immutable; locked/live grains blocked from move |
| Timeline | Assignment + Media Plan events visible on campaign spine |
| Reporting | Planned vs Actual aligns on Assignment IDs |
| Regression | Convert, Commercial SSOT, Deliverables docs, Studio export |

---

## 8. Migration Strategy (if approved)

1. **Dev first** (`hsxrewjcbvmbkqdlzjhs`) — schema only if collection pointer needs a column; otherwise JSON meta + code.
2. Backfill Assignment IDs onto slots where **unique** creator+type match exists.
3. Leave ambiguous historical slots on legacy fallback path with explicit flag in projections.
4. Feature flag optional for multi-plan UI if needed for safe soak; ID joins can ship behind same release once tested.
5. Production migration **only after** Dev → Preview → UAT → explicit Production approval (per release workflow).

---

## 9. Rollback Strategy

| Layer | Rollback |
|---|---|
| Code | Revert deploy to previous commit; optional flag off for multi-plan UI |
| JSON slot IDs | Additive fields — old readers ignore unknowns; new readers fall back to labels |
| DB column (if any) | Nullable additive only; no destructive drops in R2.1 |
| Timeline events | Append-only; harmless if UI reverts |
| Commercial / Finance | Untouched — no rollback surface |

**Invariant:** Never ship a migration that rewrites commercial snapshot or recreate Assignment IDs.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Label matching false positives remain for old plans | Medium | ID-first + flagged legacy fallback; backfill where unique |
| Multi-plan orphans if creation enabled without list UX | High | Ship list/selector with creation; keep default pointer |
| Child deliverable/post ID churn breaks tight joins | Medium | Prefer Assignment ID; treat child IDs as secondary |
| Scope creep into CIO/VIO/Invoice | High | Hard freeze — out of R2.1 |
| Parallel timeline tables proposed during impl | High | Reject; reuse `audit_logs` |
| Convert / SSOT regression | Critical | Regression suites + no convert code changes unless bugfix |
| Package multi-creator Assignment ambiguity | Medium | Slot binds to Assignment line; creator display from influencer link; document limitation |

---

## 11. Recommendations (for approval)

### Approve this implementation slice

**In scope for Release 2.1:**

1. **Assignment Linker** — add durable Assignment (+ optional Deliverable/Post) IDs to Media Plan schedule/engine/facts; ID-first Planned↔Actual.
2. **Multi Media Plan identity** — support multiple `campaign_objects` per header with list/default selection; classify plan in meta; no new ledger table.
3. **Lifecycle guards** — reuse approve/lock/history; add grain-level non-live / billing-lock checks where data exists.
4. **Enterprise Timeline contract** — normalize event metadata (incl. `campaign_line_id` when applicable); extend writers; evolve Timeline tab consumption without a second history system.
5. **Reporting join hardening** — Media Plan / performance overlays only.
6. **Tests + UAT** as above.

**Explicitly out of scope:**

- Commercial SSOT / Commercial Revision OS  
- Client IO / Vendor IO / Invoice / Billing / Payment  
- Convert redesign  
- Deliverables Documentation redesign  
- New Assignment or Media Plan tables  
- Parallel audit/timeline products  

### Implementation principles (binding)

- Do not redesign Thinkway.  
- Reuse existing services/tables/APIs/workflows.  
- Minimise DB and API surface.  
- Preserve Production behaviour for single-plan campaigns.  
- Assignment (`campaign_lines.id`) is the operational backbone.

---

## 12. Approval gate

| Item | Decision needed |
|---|---|
| Accept this validation report | **Yes / No** |
| Multi-plan identity approach | Prefer **Option B+default pointer** (query by `campaign_header_id` + meta classification; keep `campaign_object_id` as default) unless Product requires a join table |
| Timeline in 2.1 | **Contract + Media Plan/Assignment emitters + incremental Timeline tab**; full cross-finance panel completeness can continue in 2.2/2.3/3.0 |
| Feature flag | Optional for multi-plan UI; ID joins recommended always-on after Dev UAT |

**STOP — no implementation until Product approves this report.**
