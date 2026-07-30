# Release 2.1 — UAT Checklist (Interactive Preview)

**Status:** ✅ Feature Freeze approved — UAT closed  
**Environment:** Preview / Development — `https://dev.thinkwaymedia.com`  
**Feature commit:** `9d25a65` (`feat(release-2.1): harden Media Plan ↔ Assignment architecture`)  
**Hotfix commits:** `7eaf219` + `388bab6c` (DEF-R21-01 Timeline unblock)  
**U10 retest commit:** `7eaf219` (Preview build-info confirmed)  
**Supabase:** Development `hsxrewjcbvmbkqdlzjhs` (aligned)  
**Primary fixture:** TW-2026-0005 — Campaign — Quotation — TUNA DOLPHIN – DELTA CAMPAIGN (V2)  
**Campaign URL:** `/campaigns/campaign-quotation-tuna-dolphin-delta-campaign-v2-8265ff15`  
**Media Plan URL:** `…/media-plan`  
**Executed:** 2026-07-31 (Africa/Cairo)  
**Feature Freeze:** ✅ Approved 2026-07-31  
**Production:** ✅ Complete — `v2.1.0` · `35086130` · see [`RELEASE_2_1_PRODUCTION_PACKAGE.md`](./RELEASE_2_1_PRODUCTION_PACKAGE.md)

---

## Environment gate (prerequisite — Approved)

| Validation | Result |
|---|---|
| Preview commit = `9d25a65` | Pass (Ops Center: App process healthy · development · `9d25a65`) |
| Development environment | Pass |
| Dev Supabase = `hsxrewjcbvmbkqdlzjhs` | Pass |
| Database connectivity | Pass (~155 ms) |
| Configuration drift | None detected for R2.1 scope |

### Infrastructure observations (not R2.1 product defects)

| ID | Type | Severity | Blocks R2.1? | Notes |
|---|---|---|---|---|
| INFRA-01 | Redis connection closed | Medium | No* | Ops Center: Redis offline (`saved-opossum-86561.upstash.io`). *Reclassify if a UAT scenario fails due to workers. |
| INFRA-02 | BullMQ / Discovery worker | Low–Medium | No | BullMQ score healthy with zero jobs; Discovery worker not running (expected on Preview host). |
| INFRA-03 | Release Readiness “Missing local Supabase env” | Low | No | Checklist inconsistency vs connected Dev adapter — correct after R2.1; not config drift. |

---

## Scenario results

### 1. Assignment integrity

| # | Case | Result | Evidence |
|---|---|---|---|
| — | Assignments stable | **Pass** | Assignments tab: **32** lines (`TW-2026-5-A` …); hierarchy intact |
| U3 | Assignment hydration / IDs on calendar | **Pass** | Original calendar React day props: **32/32** slots carry `campaignLineId` + `assignmentDeliverableId` + `assignmentPostScheduleId` (24 unique Assignment lines; multi-post lines share line id) |
| U1 | Single Media Plan | **Pass** | Default plan loads; plan selector hidden (single plan) |

**Defects:** None

---

### 2. Multiple Media Plans

| # | Case | Result | Evidence |
|---|---|---|---|
| U2 | Multiple Media Plans | **Partial / Blocked (fixture)** | Selector correctly hidden with one plan. No second Media Plan on TW-2026-0005 to exercise `?planId=` switch / default marker in UI. |

**Coverage note:** Multi-plan list/selector covered by automated `test:release-2-1`. Interactive multi-plan switch remains fixture-blocked.

**Defects:** None (gap = fixture, not product fail)

---

### 3. ID-first Planned vs Actual

| # | Case | Result | Evidence |
|---|---|---|---|
| U4 | Planned vs Actual ID isolation | **Pass (engine + empty Actual)** | Unit suite: ID-first matching (no creator/type collision). Interactive: Actual = **0 creators / 0 live** (no publications). Cannot complete a live post on this fixture. |
| U5 | Remaining view | **Pass** | Remaining shows **32** assignment-backed cards (all grains still remaining; none live). |

**Defects:** None for R2.1 join logic. Full live Actual/Remaining delta needs a published Performance grain (follow-up fixture).

---

### 4. Enterprise Timeline

| # | Case | Result | Evidence |
|---|---|---|---|
| U10 | Timeline — Media Plan approve/lock events | **Pass (retest)** | See U10 retest below. Initial fail closed by DEF-R21-01 hotfix. |

#### DEF-R21-01 — Timeline tab hang — **Closed**

| Field | Value |
|---|---|
| Initial result | Fail (UI blocked on “Loading tab data…”) |
| Severity | Medium |
| Root cause | Timeline tab was hard-gated on deferred `financeAudit` bundle. Enterprise Timeline already uses SSR `workspace.activity` from `audit_logs`; finance audit must not block it. **Not** caused by Redis (INFRA-01): Timeline passed while Redis still offline. |
| Resolution | `7eaf219` — `TAB_BLOCKING_BUNDLES.timeline` / `TAB_ERROR_BUNDLES.timeline` = `[]`; Finance audit soft-loads in-panel. `388bab6c` — soft timeout wraps full financeAudit load path (8s). |
| Retest | **Pass** (2026-07-31 on Preview `7eaf219`) |

#### U10 retest (targeted — post hotfix)

| Check | Result | Evidence |
|---|---|---|
| Timeline loads | ✅ | Timeline & activity selected; **Enterprise Timeline** heading visible; no tab-level “Loading tab data…” in Timeline region |
| Reads `audit_logs` | ✅ | Section copy + feed from `workspace.activity` (SSR audit_logs) |
| Media Plan events visible | ✅ | Distinct events: Changes requested on approved Media Plan; Revision v2 opened; Working draft v2 created; v1 published as Current Approved Baseline; Media Plan v1 approved_on_behalf |
| Assignment events visible | ✅ | Recent assignments panel lists TW-2026-5-A… with creators; activity feed includes campaign header updates |
| Chronological ordering | ✅ | Newest-first timestamps (00:15 → 00:13 → 16:44 → …) |
| No duplicate Media Plan lifecycle events | ✅ | Five unique R2.1 Media Plan summaries (no duplicate approve/request-changes rows) |
| Loading state resolved | ✅ | Enterprise Timeline renders immediately; Finance audit soft-loads separately (“Loading finance audit…”) without gating Timeline |
| Redis dependency | ✅ Not required | INFRA-01 still open; U10 passed with Redis offline |

---

### 5. Grain lock guards

| # | Case | Result | Evidence |
|---|---|---|---|
| U6 | Live / billing-locked grain move rejected | **Blocked (fixture)** | **0/32** slots have `actualLiveDate`; all `executionStatus: planned`. No live/billing-locked grain to drag. Unit tests cover guard messages. |
| U7 | Draft grain movable | **Pass** | After Request Changes: tip **v4.1 Draft**; **32** `draggable` + editable cards; toolbar Undo/Compare/Lock/Approve restored. |
| U8 | Approve / lock | **Pass** | Approve on Behalf → approved baseline locked (Request Changes / Unlock). History: **v1.0 approved · Today 12:12 AM**. Request Changes returned editable draft while approved baseline retained. |
| U9 | Versioning | **Pass** | Edit History (21 edits) + Business Versions: Current **v4.1**; approved **v1.0**; prior **v1–v3** preserved. |

**Defects:** None for exercised paths. U6 interactive retest when a live Performance grain exists.

---

### 6. Regression validation

| # | Case | Result | Evidence |
|---|---|---|---|
| R4 | Campaign ↔ Media Plan navigation | **Pass** | Media Plans link / Back to campaign / Assignments ↔ Media Plan |
| R3 | Deliverables documentation | **Pass (smoke)** | Deliverables tab count **84**; documentation status controls present on Media Plan cards |
| R2 | Commercial SSOT | **Pass (scope)** | No commercial write-path changes in R2.1 commit; Client IO / Billing tabs still present |
| R1 | Convert to Campaign | **Not re-run** | Flag-gated; out of interactive fixture path this session |
| R5 | Media Plan exports | **Not re-run** | PDF/HTML/Excel not exercised this session |
| U11 | Portal Media Plan | **Not re-run** | No portal session this package |
| U12 | Studio generate | **Partial** | “Open in Studio” control present; full generate/regenerate not re-executed |

---

## Checklist matrix

### Functional

| # | Case | Expect | Pass |
|---|---|---|---|
| U1 | Single Media Plan campaign | Default plan loads; selector hidden when only one plan | ✅ |
| U2 | Multiple Media Plans | Selector lists plans; `?planId=` switches; default marked | ⏸ Fixture |
| U3 | Assignment hydration | Empty slate / calendar slots carry Assignment IDs | ✅ |
| U4 | Planned vs Actual | Completing one Assignment post does not mark another | ✅ Engine / ⏸ Live fixture |
| U5 | Remaining view | Completed Assignment grains leave Remaining | ✅ (all remaining) |
| U6 | Live grain move | Drag of live / locked grain rejected | ⏸ Fixture (unit ✅) |
| U7 | Draft move | Non-live draft grain still movable | ✅ |
| U8 | Approve / lock | Approval + immutable baseline unchanged | ✅ |
| U9 | Versioning | Revise / regenerate / history unchanged | ✅ |
| U10 | Timeline | Media Plan approve/lock events under Enterprise Timeline | ✅ (retest) |
| U11 | Portal Media Plan | Client approve / request changes on default plan | ⏸ Not run |
| U12 | Studio generate | Generate/regenerate; cards carry Assignment refs | ⏸ Partial |

### Regression

| # | Case | Expect | Pass |
|---|---|---|---|
| R1 | Convert to Campaign | Unchanged (flag-gated) | ⏸ Not run |
| R2 | Commercial SSOT | No commercial write path changes | ✅ Scope |
| R3 | Deliverables documentation | Upload / completeness unchanged | ✅ Smoke |
| R4 | Campaign navigation | Media Plan entry from campaign workspace | ✅ |
| R5 | Exports | PDF/HTML/Excel still generate | ⏸ Not run |

---

## Defect register

| ID | Severity | Scenario | Summary | Status |
|---|---|---|---|---|
| DEF-R21-01 | Medium | U10 | Timeline gated by financeAudit deferred bundle | **Closed** (`7eaf219` / retest Pass) |
| INFRA-01 | Medium | Env | Redis connection closed on Preview Ops Center | Open (tracked; not R2.1 scope) |
| INFRA-03 | Low | Env | Release Readiness “Missing local Supabase env” vs live Dev adapter | Open (post-R2.1 checklist fix) |

**Critical / High / Medium product defects open:** **None**

---

## Automated evidence (pre-UAT)

| Suite | Result |
|---|---|
| `npm run test:release-2-1` | 28/28 Pass |
| `npm run test:media-plan-phase1` | 30/30 Pass |
| Combined | **58/58 Pass** |

---

## Preview summary (for Feature Freeze review)

### What passed interactively

- Assignment integrity (32 lines) + **32/32** calendar slots with full Assignment refs  
- Single-plan default behaviour  
- Approve on Behalf → lock → Request Changes → draft tip **v4.1** with approved **v1.0** retained  
- Versioning / Edit History intact  
- Remaining view assignment-backed; Actual empty as expected (no live Performance)  
- Draft editability (U7) after Request Changes  
- Campaign workspace Assignments / Media Plan navigation regression  

### What did not fully close (non-blocking fixture gaps)

- Multi-plan UI, live grain guard, portal, Studio generate, Convert, exports — fixture/session gaps (engine coverage where noted)
- INFRA-01 Redis remains open (infrastructure; not R2.1 product)

### Feature Freeze declaration

**Feature Freeze approved 2026-07-31.**

Effective immediately for Release 2.1:

- No functional scope changes, architectural changes, schema changes, API redesign, UI enhancements, or refactoring.
- Only release-critical Production hotfixes may be accepted after this point.
- Production deployment remains **blocked** until separate Production Approval after review of [`RELEASE_2_1_PRODUCTION_PACKAGE.md`](./RELEASE_2_1_PRODUCTION_PACKAGE.md).

---

## Sign-off

| Role | Name | Date | Result |
|---|---|---|---|
| Product | Approved | 2026-07-31 | ✅ Feature Freeze |
| Operations | | | |
| Engineering | Interactive UAT + U10 retest (agent) | 2026-07-31 | U10 Pass; DEF-R21-01 Closed |

---

## Governance snapshot (Feature Freeze)

| Gate | Status |
|---|---|
| Architecture | ✅ Approved |
| Architecture Validation | ✅ Approved |
| Implementation | ✅ Complete |
| Automated Tests | ✅ Passed |
| Commit / Push | ✅ Complete (`9d25a65` + hotfixes `7eaf219`, `388bab6c`) |
| Environment Validation | ✅ Passed |
| Interactive UAT | ✅ Complete (U10 retest Pass) |
| DEF-R21-01 | ✅ Closed |
| Feature Freeze | ✅ **Approved** |
| Production package | ✅ Approved |
| Production Deployment | ✅ Complete (`v2.1.0`) |
| Next | Release 2.2 planning / implementation on `develop` |
