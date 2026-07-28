# Media Planning v1 — Production Readiness Report

**Status:** Feature complete (approved) — **feature development frozen**  
**Branch:** `feature/unified-media-plan`  
**Date:** 2026-07-27  
**Role:** **Canonical source of truth** for Media Planning v1 implementation, release, and production deployment

This report **supersedes** phase-by-phase notes for all release and deployment decisions. Phase reports and the architecture plan are retained as **historical** references (not deleted) and link back here.

| Doc | Role after v1 |
|---|---|
| **This file** | Canonical SSOT |
| `MEDIA_PLAN_VERSIONING.md` | Business version lifecycle (Draft → Approved); revise vs regenerate; audit vs business version |
| `UNIFIED_MEDIA_PLAN_PLAN.md` | Design principles (superseded for release) |
| `UNIFIED_MEDIA_PLAN_PHASE1_WRITE_PATHS.md` | Historical Phase 1 |
| `UNIFIED_MEDIA_PLAN_PHASE2_REPORT.md` | Historical Phase 2 |
| `UNIFIED_MEDIA_PLAN_PHASE3_REPORT.md` | Historical Phase 3 |
| `UNIFIED_MEDIA_PLAN_PHASE4_REPORT.md` | Historical Phase 4 |

### Scope boundary

| In v1 (complete) | Out of v1 — Release 2 only (§9) |
|---|---|
| Engine, baseline/draft, Studio writes | Portal Actual / Remaining |
| Campaign Original / Actual / Remaining | Portal Comparison Mode |
| Timeline, Compare, internal approval | Baseline item snapshot refinement (unless QA bug) |
| Client Portal Original + Approve / Request Changes / Reject | Notifications, Preview Mode, reporting SSOT exports |

Do **not** begin Release 2 or other Media Planning features unless newly approved.

---

## 1. Architecture summary

### Goal

One Media Plan capability shared by **Studio**, **Campaign workspace**, and **Client Portal**, with:

- Immutable **Current Approved Baseline**
- At most one **Working Draft**
- **Actual / Remaining** derived only from the approved baseline + Performance facts
- A single **Media Plan Engine** as the sole owner of scheduling business logic

### Design invariants (v1)

| Invariant | Implementation |
|---|---|
| Single Engine | `lib/media-plan` (`mediaPlanEngine` facade) |
| Shared identity | `mediaPlanId` ≡ `campaign_objects.id` (Studio ↔ Campaign) |
| Schedule storage | `campaign_objects` / versions + `meta.mediaPlanSchedule` + `meta.mediaPlanLifecycle` |
| No parallel tables | No new `media_plans` entity set |
| Shared calendar UI | `features/campaign-outputs/components/media-plan-calendar.tsx` |
| Engine-only writes | Bridge: `features/campaign-outputs/media-plan-mutations.ts` |
| Outputs consume, never mutate | Ownership guards + write-path audit tests |
| Actual / Remaining | Engine `projectExecutionViews` over approved baseline + live dates |

### Surfaces

```
Studio (edit tip when draft)
    │
    ▼
Media Plan Engine  ←── Campaign workspace (Original / Actual / Remaining)
    │
    ├── Timeline (audit_logs)
    ├── Comparison (baseline vs draft)
    └── Client Portal (Original + Approve / Request Changes / Reject)
```

### Status model

| Status | Editable tip | Regenerate | Client Portal |
|---|---|---|---|
| Draft | Yes | Enabled | Hidden (not shared) |
| Locked | No | Disabled | Pending review + decisions |
| Pending Approval | No | Disabled | Pending review + decisions |
| Approved by Client | No (baseline) | Disabled | Approved Original; Request Changes |
| Approved on Behalf | No (baseline) | Disabled | Approved Original; Request Changes |

### Module map

| Layer | Path |
|---|---|
| Engine | `lib/media-plan/*` |
| Mutation bridge | `features/campaign-outputs/media-plan-mutations.ts` |
| Internal lifecycle actions | `features/campaign-outputs/actions/media-plan-lifecycle-actions.ts` |
| Schedule DnD action | `features/campaign-outputs/actions/update-media-plan-schedule.ts` |
| Campaign loader / UI | `features/campaigns/queries/load-campaign-media-plan.ts`, `features/campaigns/components/media-plan/*` |
| Portal loader / UI / actions | `features/portals/queries/*`, `features/portals/components/client-media-plan-*`, `features/portals/actions/client-media-plan-actions.ts` |
| Timeline | `lib/media-plan/log-media-plan-timeline.ts` → `audit_logs` |

---

## 2. Database changes

### New migration (v1)

| Migration | Purpose | Dev | Prod |
|---|---|---|---|
| `supabase/migrations/20260727120000_campaign_objects_client_portal_select.sql` | SELECT policies on `campaign_objects` / `campaign_object_versions` when `can_access_campaign_header(campaign_header_id)` | **Applied** (`hsxrewjcbvmbkqdlzjhs`) | **Not applied** — wait for explicit Production approval |

No new tables, columns, or RPC entities for Media Planning v1.

### Existing storage reused

| Asset | Role |
|---|---|
| `campaign_objects` | Shared Media Plan identity + tip |
| `campaign_object_versions` | Versioned persistence |
| `campaign_headers.campaign_object_id` | Campaign ↔ Studio linkage |
| Object `meta.mediaPlanSchedule` | Schedule tip |
| Object `meta.mediaPlanLifecycle` | Status, draft/baseline pointers, approved snapshots, history |
| `audit_logs` | Campaign Timeline Activity (Media Plan lifecycle events) |
| Performance / assignment live dates | Actual projection inputs |

### Schema notes

- Portal users receive **SELECT-only** access via campaign-header RLS.  
- Portal **writes** persist through service-role **after** `client_portal.approve` + approve-role + client_id scope checks (no client write RLS on campaign objects).  
- Formal `supabase db push` may still be blocked by older unapplied local migrations on Dev; Dev policy SQL was applied via linked `db query`. Before Production, confirm migration history ordering and apply through the approved release workflow.

---

## 3. New APIs

Media Planning v1 does **not** introduce public REST routes. All mutations are Next.js **server actions**.

### Internal (Studio / Campaign) — permission `ai.write`

| Action | File | Engine entry |
|---|---|---|
| `updateMediaPlanScheduleAction` | `update-media-plan-schedule.ts` | `mutateMediaPlanSchedule` |
| Market intelligence schedule updates | `update-campaign-market-intelligence.ts` | `mutateMediaPlanSchedule` |
| `lockMediaPlanAction` | `media-plan-lifecycle-actions.ts` | `lockMediaPlanOnCampaignObject` |
| `unlockMediaPlanAction` | same | `unlockMediaPlanOnCampaignObject` |
| `approveMediaPlanAction` | same | `approveMediaPlanOnCampaignObject` |
| `requestMediaPlanChangesAction` | same | `requestChangesMediaPlanOnCampaignObject` |
| `rejectMediaPlanAction` | same | `rejectMediaPlanOnCampaignObject` |

Also Engine-wired (non-action): Studio Copilot reschedule / regenerate prepare, brief merge week weights.

### Client Portal — permission `client_portal.approve` + approve role

| Action | File | Engine entry |
|---|---|---|
| `clientApproveMediaPlanAction` | `client-media-plan-actions.ts` | `approveMediaPlanOnCampaignObject` (`method: client_portal`) |
| `clientRequestMediaPlanChangesAction` | same | `requestChangesMediaPlanOnCampaignObject` |
| `clientRejectMediaPlanAction` | same | `rejectMediaPlanOnCampaignObject` |

### Loaders (server queries)

| Loader | Consumers |
|---|---|
| `loadCampaignMediaPlanWorkspace` | Campaign Media Plan page |
| `loadClientMediaPlan` | Client Portal Media Plan page |

---

## 4. New routes

| Route | Audience | Behavior |
|---|---|---|
| `/campaigns/[id]/media-plan` | Internal | Full workspace: Original / Actual / Remaining, comparison, approval toolbar, Studio launcher |
| `/campaigns/[id]/media-plan?view=actual\|remaining` | Internal | Same page, view query |
| `/client-portal/campaigns/[id]/media-plan` | Client Portal | Read-only calendar; Approve / Request Changes / Reject when eligible |

Helper: `campaignMediaPlanPath()` in `lib/routing/entity-paths.ts`.  
Entry points: Campaign workspace **Media Plans** button; Client Portal campaigns table campaign name link.

---

## 5. Security considerations

| Topic | Control |
|---|---|
| Internal mutations | `requirePermission(..., "ai.write")` + conversation-owned campaign object load |
| Portal read | `client_portal.read` + `client_id ∈ scope.clientIds` + new SELECT policies via `can_access_campaign_header` |
| Portal decide | `client_portal.approve` + `client_users.access_role === "approve"` + campaign linkage check |
| Portal persist | Service role only **after** authz; never imported from Client Components (`server-only` admin module) |
| Baseline immutability | Engine rejects in-place mutation of approved versions; draft fork required |
| Output generators | Ownership guard blocks schedule mutation sources |
| Write-path audit | `media-plan-write-path-audit.test.ts` blocks direct `mediaPlanSchedule` assigns / unchecked apply outside allowlist |
| Timeline integrity | Lifecycle events logged to `audit_logs` with `source: media_plan_engine`; failures do not roll back decisions |
| Data exposure | Portal never shows unshared drafts; pending review shows locked tip; approved Original uses baseline only |

### Residual risks

1. Service-role persist path for portal decisions must remain tightly gated (scope + role checks before admin client).  
2. Conversation context snapshot update may no-op for portal actors (not conversation owner); version persistence is the SSOT.  
3. Campaign-header-scoped SELECT on campaign objects widens read beyond conversation owners — intentional for portal/campaign; ensure `can_access_campaign_header` stays correct.

---

## 6. Performance considerations

| Area | Notes |
|---|---|
| Calendar | Single shared `MediaPlanCalendar`; avoid duplicate grids |
| Campaign load | One campaign object version load + assignment hierarchy for Actual/Remaining |
| Portal load | Header scope check + object version load; no Actual/Remaining in v1 portal |
| Compare | Pure Engine diff over in-memory items — no extra DB round-trips |
| Timeline | Filtered lifecycle events only (`schedule_edited` / `sync` excluded) |
| Regenerates | Generator may be heavy; regenerate only on draft tip; portal does not regenerate |

### Budgets / monitoring

- No dedicated Media Plan Redis/queue work in v1.  
- Watch Campaign Media Plan page TTFB when assignment hierarchy is large.  
- Prefer keeping calendar client-bound and loaders server-side as today.

---

## 7. Regression coverage

### npm scripts

```bash
npm run test:media-plan-engine
npm run test:media-plan-phase1
npm run test:media-plan-phase2
npm run test:media-plan-phase3
npm run test:media-plan-phase4
```

### Coverage matrix

| Surface | What’s covered |
|---|---|
| Engine | Baseline/draft invariants, regenerate policy, Actual/Remaining, compare, ownership, timeline event shapes |
| Studio write paths | Mutations, lock/unlock/approve/reject/request changes, write-path audit, schedule/market intelligence |
| Campaign calendar | Adapter round-trip, Actual/Remaining via Engine + calendar |
| Timeline filter | Approval/revision events included; noisy edits excluded |
| Client Portal | Unshared draft hidden; pending review tip; approved Original ≠ draft tip; decision flags |

### Manual QA checklist (pre-Production)

- [ ] Studio: DnD schedule on draft; blocked when locked/approved  
- [ ] Studio/Campaign: Lock → Approve by Client → baseline frozen; unlock forks draft  
- [ ] Campaign: Original / Actual / Remaining tabs; Compare when draft exists  
- [ ] Campaign Timeline Activity shows Media Plan lifecycle summaries  
- [ ] Portal: Locked plan visible for approve role; Approve publishes baseline  
- [ ] Portal: Request Changes / Reject return plan for internal revision without mutating prior baseline  
- [ ] Portal view-only role cannot decide  
- [ ] Ops Center: Dev/Prod Supabase alignment after deploy  

---

## 8. Remaining technical debt

| Item | Severity | Notes |
|---|---|---|
| Dev migration history ordering | Medium | Older local migrations may block clean `db push`; Production apply must use approved workflow + verification |
| Portal conversation snapshot update | Low | Best-effort; version row is authoritative |
| Baseline item snapshot fidelity | Low | Schedule-meta snapshots + regenerate path sufficient for v1; refine if QA finds tip/baseline visual drift on complex moves |
| Campaign workspace regenerate CTA | Low | Studio path wired; dedicated Campaign button optional |
| Formal `schema_migrations` recording for Dev ad-hoc apply | Medium | Confirm Production migration is recorded when applied |

**Not v1 blockers.** Address during Dev QA / Production prep as needed.

---

## 9. Future enhancement opportunities (Release 2)

**Not in Media Planning v1.** Do not implement unless a new requirement is explicitly approved. Candidates only:

1. **Portal Actual / Remaining** — same calendar, Engine projections, read-only  
2. **Portal Comparison Mode** — baseline vs proposed locked tip before approve  
3. **Baseline item snapshot refinement** — richer per-item freeze when tip diverges strongly  
4. **Dedicated regenerate control** on Campaign workspace (still Engine-gated)  
5. **Notifications** on lock / client decision / changes requested  
6. **Reporting / export** consumption of approved baseline as SSOT  
7. **Preview Mode** — optional draft preview for Actual/Remaining (explicitly out of v1)  
8. **Internal approval step** distinct from client approval (workflow engine)  
9. **Migration hygiene** — reconcile Dev/Prod migration history for push-based deploys  

---

## 10. Production deployment checklist

Follow `docs/RELEASE_WORKFLOW.md` and engineering deployment policy.  
**Development first. Production only after explicit approval.**

### Pre-merge (feature → `develop`)

- [x] Feature complete on `feature/unified-media-plan`  
- [x] Rebased onto latest `develop`  
- [x] Media Plan regression suite green (engine + phases 1–4)  
- [ ] PR review + merge to `develop`  
- [ ] Auto-deploy to Development (`https://dev.thinkwaymedia.com`) verified  

### Development verification

- [x] Migration `20260727120000_campaign_objects_client_portal_select.sql` applied on Dev (`hsxrewjcbvmbkqdlzjhs`) via linked `db query`  
- [ ] Studio / Campaign / Portal smoke paths (manual QA above) on Dev deploy  
- [ ] Operations Center: environment = Development, Supabase ref = `hsxrewjcbvmbkqdlzjhs`  
- [ ] TypeScript / build / Ops health green on Dev deploy  

### Production (requires explicit user approval)

**Target project:** `ienowhwfyxoqtzbgltno` (`thinkway-production`)  
**Do not proceed without approval.**

1. [ ] Deployment summary approved (this report + file/migration list)  
2. [ ] Apply migration `20260727120000_campaign_objects_client_portal_select.sql` to Production  
3. [ ] Verify policies exist on `campaign_objects` / `campaign_object_versions`  
4. [ ] Deploy Production app (`app.thinkwaymedia.com`) via approved path  
5. [ ] Operations Center: Production ↔ `ienowhwfyxoqtzbgltno` aligned  
6. [ ] Smoke: Campaign Media Plan page + Client Portal Media Plan (approve-role test account)  
7. [ ] Confirm Timeline events appear after a Dev-mirrored approve flow on a safe test campaign  
8. [ ] Rollback plan: revert app deploy; DROP the two SELECT policies if needed (no data migration to undo)

### Rollback notes

- Application rollback: redeploy previous Production build.  
- DB rollback: drop policies `campaign_objects_select_via_campaign_header` and `campaign_object_versions_select_via_campaign_header` only (no destructive data changes in v1).  
- Lifecycle meta already stored on objects remains backward-compatible with Engine readers.

---

## Commit series (feature branch)

Expected order on `feature/unified-media-plan` (verify with `git log origin/develop..HEAD`):

| Scope | Message prefix |
|---|---|
| Phase 0 | `feat(media-plan): add Media Plan Engine foundations` |
| Phase 1 | `feat(media-plan): wire Studio schedule mutations through Media Plan Engine` |
| Phase 2 | `feat(media-plan): Campaign full-page Media Plan workspace` |
| Phases 3–4 | `feat(media-plan): Timeline, comparison, approval, and Client Portal Original` |
| Portal decisions | `feat(media-plan): Client Portal Approve, Request Changes, and Reject via Engine` |
| Docs (final v1) | `docs(media-plan): Media Planning v1 production readiness SSOT` |

---

## Sign-off

| Item | State |
|---|---|
| Media Planning v1 feature scope | **Complete / approved** |
| Feature development | **Frozen** — no new Media Planning work unless requirements are approved |
| Implementation SSOT | **This document** |
| Next engineering step | PR merge → `develop` → Dev QA → explicit Production approval |
