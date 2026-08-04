# Release 2.3 — Production Release Package

**Status:** ✅ **CLOSED** · Production Acceptance **PASS** · Tags **`v2.3.0`** + Stabilization **`v2.3.1`**  
**Validation report:** [`RELEASE_2_3_PRODUCTION_VALIDATION_REPORT.md`](./RELEASE_2_3_PRODUCTION_VALIDATION_REPORT.md)  
**Stabilization Production report:** [`RELEASE_2_3_STABILIZATION_PRODUCTION_REPORT.md`](./RELEASE_2_3_STABILIZATION_PRODUCTION_REPORT.md)  
**Product Acceptance (Dev):** ✅ Accepted 2026-08-03 · Score **≥96/100** · Stabilization Product BUY **YES** 2026-08-04  
**Fresh Prod acceptance:** ✅ TW-2026-0002 enterprise journey PASS (2026-08-03)  
**Feature Freeze / Maintenance Mode:** Released with closure — see Release 2.4 kickoff  
**Release tip (initial close):** `c23a3a0e` · **Stabilization tip:** `e51d16a7` (`main` merge `ffd31694`)  
**Production deploy (stabilization):** `dpl_9YTfXFj2gDDZFs85NGhgknEHj3dd` · `https://app.thinkwaymedia.com`  
**Prior deploy:** `dpl_2TzvSBDFLPs6tb6ite7FfaeTg3sj`  
**Production Supabase:** `ienowhwfyxoqtzbgltno` (aligned)  
**Migrations:** ✅ 13/13 (2026-08-03) + STAB-038/040 (2026-08-04)  
**Next:** [`docs/release/2.4/README.md`](../release/2.4/README.md)  

### Pre-authorization conditions

| # | Condition | Status |
|---|---|---|
| C1 | Deploy tip `027bf2ef` only (clean worktree) | ✅ |
| C2 | `CREATOR_CRM_WRITERS_ENABLED=false` | ✅ |
| C3 | Prod Supabase `ienowhwfyxoqtzbgltno` | ✅ |
| C4 | `READY_API_SECRET` + `INVITE_TOKEN_SECRET` | ✅ |
| C5 | Doc Lifecycle backfill acknowledged | ✅ (`UPDATE 0`) |
| C6 | Full R2.3 smoke breadth | ⚠ Journey through Approval PASS; Generate FAIL (data) |

**Parent refs**

| Doc | Role |
|---|---|
| [`RELEASE_WORKFLOW.md`](../RELEASE_WORKFLOW.md) | Dual deploy · approval gate |
| [`PRODUCTION_DEPLOYMENT_GUIDE.md`](../production-readiness/PRODUCTION_DEPLOYMENT_GUIDE.md) | Env / secrets / worker |
| [`PRODUCTION_ROLLOUT_CHECKLIST.md`](../production-readiness/PRODUCTION_ROLLOUT_CHECKLIST.md) | Generic rollout |
| [`FEATURE_FLAG_GUIDE.md`](../production-readiness/FEATURE_FLAG_GUIDE.md) | Flag matrix |
| [`ENTERPRISE_CREATOR_INTELLIGENCE_ACCEPTANCE.md`](./ENTERPRISE_CREATOR_INTELLIGENCE_ACCEPTANCE.md) | ECI freeze |
| [`PLATFORM_ARCHITECTURE_COMPLIANCE.md`](./PLATFORM_ARCHITECTURE_COMPLIANCE.md) | Frozen packages |
| [`docs/release/2.3/FINAL_STABILIZATION.md`](../release/2.3/FINAL_STABILIZATION.md) | Stabilization scope |
| [`RELEASE_2_2_PRODUCTION_PACKAGE.md`](./RELEASE_2_2_PRODUCTION_PACKAGE.md) | Prior release / OPS-EMAIL carry-forward |

**Hard exclusions (not part of this release tip)**

| Item | Disposition |
|---|---|
| Wave 1 Studio live-discovery (local uncommitted) | **Exclude** — do not merge/deploy |
| Local `scripts/tmp-*` soak harnesses | **Exclude** |
| Uncommitted Dev readiness doc churn | **Exclude** unless separately approved as ops hygiene |

---

## Governance snapshot

| Stage | Status |
|---|---|
| Architecture packages (ECI · Doc Lifecycle · Change Impact · Studio S2/S3) | ✅ Frozen · Maintenance Mode |
| Development implementation | ✅ Complete on tip `027bf2ef` |
| Development Product Acceptance | ✅ Passed (≥96) |
| Feature Freeze | ✅ **Release 2.3 Maintenance Mode** |
| Production Release Package | ✅ This document |
| **Production Approval** | ⛔ **Required — wait** |
| Production DB migrations | ⛔ Not started |
| Production app deploy | ⛔ Not started |
| Next initiative after Prod approval | **Release 2.4** |

---

## 1. Production deployment plan

**Do not execute until Product issues explicit Production Approval.**

### 1.1 Preconditions

1. Tip remains `027bf2ef` (or a **Critical-only** hotfix cherry-picked onto that tip).  
2. Working tree for release contains **no** Wave 1 live-discovery or tmp harness commits.  
3. Development Deployment Readiness still green on `dev.thinkwaymedia.com` ([checklist](../infrastructure/DEVELOPMENT_DEPLOYMENT_READINESS_CHECKLIST.md)).  
4. CI Validate green on the release tip.  
5. Production target confirmed: Supabase **`ienowhwfyxoqtzbgltno`**, host **`https://app.thinkwaymedia.com`**, Production Redis (never Dev).

### 1.2 Execution sequence (normative)

| Step | Action | Owner | Notes |
|---|---|---|---|
| D0 | Product records written **Production Approval** for tip `027bf2ef` | Product | Gate |
| D1 | Freeze announcement: R2.3 Maintenance Mode; only Critical hotfixes | Eng | Already in force |
| D2 | Apply **13** Production migrations in order (§2) via Production-guarded path (`scripts/psql-production.mjs` or linked `supabase` against **prod ref only**) | Eng | State project ref before every write |
| D3 | Verify schema objects on Production (§2.3) | Eng | Fail → stop |
| D4 | Confirm Vercel Production env matrix (§3) + feature flags (§4) | Eng | Fail → stop |
| D5 | Merge `develop` @ `027bf2ef` → `main` (PR preferred) | Eng | No extra feature commits |
| D6 | Deploy Production: `npx vercel deploy --prod --non-interactive` (or approved promote) | Eng | Prefer CLI; `[deploy-production]` only if deliberate |
| D7 | Restart/redeploy Discovery worker if schema/queue consumers require it | Eng | Prod Redis + Prod Supabase |
| D8 | Ops Center: env=Production · Supabase=`ienowhwfyxoqtzbgltno` · git SHA matches tip | Eng | Mismatch → rollback (§5) |
| D9 | Production smoke (§6) | Eng + Product | |
| D10 | Post-deploy validation (§7) + monitoring watch (§8) | Eng | 30–60 min minimum |
| D11 | Tag `v2.3.0` + close release notes | Eng | After D9–D10 pass |
| D12 | Reopen roadmap: **Release 2.4** | Product | Not before D11 |

### 1.3 Environments (must stay isolated)

| Surface | URL | Supabase | Git |
|---|---|---|---|
| Development | https://dev.thinkwaymedia.com | `hsxrewjcbvmbkqdlzjhs` | `develop` |
| Production | https://app.thinkwaymedia.com | `ienowhwfyxoqtzbgltno` | `main` after approved merge |

In-app environment switch **navigates hosts only** — never swaps DB/Redis inside one process.

### 1.4 Downtime / blast radius

| Area | Expectation |
|---|---|
| App deploy | Brief Vercel promote window; no planned maintenance page |
| Migrations | Additive (enums, tables, columns, RLS). Expect short exclusive locks on ALTER/CREATE; schedule in low-traffic window if possible |
| Commercial ledgers | No invoice engine redesign in this tip; CIO/VIO paths gain lifecycle/approval fields |
| Data rewrite | None required; ECI tables start empty until backfill/enrichment jobs (optional post-deploy) |

---

## 2. Database migration plan (execution order)

**Target after approval:** Production `ienowhwfyxoqtzbgltno`  
**Validated on:** Development `hsxrewjcbvmbkqdlzjhs`  
**Already on Production (R2.2):** `20260731120000` · `20260731130000` · `20260731140000` (Client IO composer / amendments / milestones)

### 2.1 Ordered allow-list (apply exactly in this order)

| # | Migration | Purpose |
|---|---|---|
| 1 | `20260731150000_vendor_io_delivery.sql` | Vendor IO delivery metadata |
| 2 | `20260731151000_vendor_io_delivery_recipient.sql` | Delivery recipient |
| 3 | `20260731160000_io_approval_one_click.sql` | One-click IO approval audit + supersede token clear |
| 4 | `20260731161000_io_approval_idempotent.sql` | Idempotent approval |
| 5 | `20260802010000_enterprise_document_lifecycle_enums.sql` | Enum values (`revision_required`, etc.) — **must precede engine** |
| 6 | `20260802011000_enterprise_document_lifecycle_engine.sql` | Document lifecycle tables / transitions |
| 7 | `20260802020000_enterprise_change_impact_engine.sql` | Change impact assessments (above Doc Lifecycle) |
| 8 | `20260802120000_enterprise_creator_intelligence_historical.sql` | ECI Sprint 1 — monthly series + history columns |
| 9 | `20260802130000_enterprise_creator_intelligence_commercial.sql` | ECI Sprint 2 |
| 10 | `20260802140000_enterprise_creator_intelligence_category_brand.sql` | ECI Sprint 3 |
| 11 | `20260802150000_enterprise_creator_intelligence_performance.sql` | ECI Sprint 4 |
| 12 | `20260802160000_enterprise_creator_intelligence_audience.sql` | ECI Sprint 5 |
| 13 | `20260802170000_enterprise_creator_intelligence_investment.sql` | ECI Sprint 6 — investment score SSOT storage |

**Rule:** Never apply #6 before #5 (PostgreSQL enum visibility). Never skip order.

### 2.2 Execution method (after approval)

1. State aloud: **modifying Production `ienowhwfyxoqtzbgltno`**.  
2. Prefer `node scripts/psql-production.mjs -f supabase/migrations/<file>.sql` (ref-guarded) **or** `npx supabase link --project-ref ienowhwfyxoqtzbgltno` then controlled push of **only** pending migrations.  
3. Refuse any connection string containing Dev ref `hsxrewjcbvmbkqdlzjhs`.  
4. Record applied versions in release evidence table (§7).

### 2.3 Post-migration verification (Production)

| Check | Expect |
|---|---|
| `client_ios` / `vendor_ios` approval audit columns | Present |
| Document lifecycle enums / tables | Present; app can transition without 500s |
| `change_impact_assessments` (+ related) | Present |
| `creator_intelligence_monthly_metrics` (+ ECI sprint tables) | Present |
| Investment / ECI read path | Returns empty/partial bundles without crash (coverage honesty) |
| RLS | Internal roles can read; anon cannot escalate |

---

## 3. Environment verification

Complete **before** promote (and re-check after).

| # | Check | Production expect |
|---|---|---|
| E1 | `NEXT_PUBLIC_SUPABASE_URL` / anon key | Production project `ienowhwfyxoqtzbgltno` |
| E2 | `SUPABASE_SERVICE_ROLE_KEY` | Production service role (never Dev key) |
| E3 | `REDIS_URL` | Production Redis only |
| E4 | `THINKWAY_ENV` / `NEXT_PUBLIC_THINKWAY_ENV` | `production` |
| E5 | `NEXT_PUBLIC_APP_URL` | `https://app.thinkwaymedia.com` |
| E6 | `NEXT_PUBLIC_DEVELOPMENT_APP_URL` / `NEXT_PUBLIC_PRODUCTION_APP_URL` | Dev + Prod hosts set |
| E7 | `CRON_SECRET`, `READY_API_SECRET`, `INVITE_TOKEN_SECRET` | Present |
| E8 | `OPENAI_API_KEY` | Present if Studio / Intelligence enabled |
| E9 | Worker env | Same Prod Supabase + Prod Redis |
| E10 | Ops Center | Environment=Production · Supabase aligned · no mismatch warning |
| E11 | `/api/health` + `/api/ready` | Healthy |
| E12 | Email (carry-forward from R2.2 OPS-EMAIL) | Gmail/SMTP secrets present if Client/Vendor IO send is in scope for smoke |

---

## 4. Feature flag verification

| Flag | Production policy for R2.3 | Verify |
|---|---|---|
| `RELEASE_2_0_ASSIGNMENT_CONVERT` (+ `NEXT_PUBLIC_…`) | Explicit Product decision: keep current Prod value unless this release intentionally enables Convert. Code default **OFF** if unset. | Confirm Vercel Production value matches Product intent before smoke |
| `CREATOR_CRM_WRITERS_ENABLED` | Per [`PRODUCTION_DEPLOYMENT_GUIDE.md`](../production-readiness/PRODUCTION_DEPLOYMENT_GUIDE.md): **must be `false` / off on Production** unless Product explicitly enables CRM writers. (Code default when unset is ON — **do not leave unset** if policy is OFF.) | Explicit `false` recommended |
| `CREATOR_CRM_FILTER_ENABLED` / `NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED` | Match Product inventory policy; unset defaults ON in code | Confirm intentional |
| Wave 1 live-discovery flags / env (if any local) | **Must not ship** with this tip | Absent |

No new R2.3-specific product feature flag is required for the Planning/Studio/ECI tip; behavior is code-path driven once schema + app are live.

---

## 5. Rollback plan

| Layer | Action | Notes |
|---|---|---|
| **App (primary)** | Redeploy / promote prior Production deployment (pre-R2.3 `main` tip, currently `c6e4cccf` lineage) | Fastest recovery |
| **Worker** | Redeploy prior worker image/config matching rolled-back app | Avoid schema/app skew |
| **Feature flags** | Disable Convert / CRM writers immediately if those surfaces regress | No schema change |
| **Schema** | Migrations are **additive**. Do **not** DROP tables/enums in panic | Prefer code rollback; reverse migration only with explicit approval |
| **Documents / IO** | Approval audit columns / lifecycle statuses remain; older readers should ignore unknown fields | Do not rewrite historical snapshots |
| **ECI tables** | Leave in place empty/partial; consumers tolerate missing bundles | Do not truncate production history captures |
| **Data** | No destructive backfill in this release — nothing to “un-backfill” | |

**Rollback triggers:** Auth/RLS lockout · Ops Center Supabase mismatch · queue total stall · Studio/CIP hard-500 spike · Campaign handoff creating corrupt headers/lines · accidental CRM writers ON with write storm.

---

## 6. Production smoke test checklist

Use a **controlled internal fixture** — do not mutate live client campaigns unless Product approves.

| # | Smoke | Expect | ☐ |
|---|---|---|---|
| S1 | Login (privileged path / MFA if applicable) | Session OK | ☐ |
| S2 | Ops Center | Prod · `ienowhwfyxoqtzbgltno` · SHA = release tip | ☐ |
| S3 | Discovery Browse + Creator Detail | Loads; Investment score from ECI or honest “—” | ☐ |
| S4 | Discovery Compare | Investment Score column; no Thinkway-as-investment SSOT | ☐ |
| S5 | Studio — new brief (category-distinct brand) | Criteria vertical correct; slate FIT≥60 or explicit refuse | ☐ |
| S6 | Studio — why-selected | Present on slate after IS scaffolding; survives section merge | ☐ |
| S7 | Studio — Planning Confidence | Moderate when evidence mixed; not inflated above avgFit | ☐ |
| S8 | Director finalize → Approval → Freeze | Package ready; media_plan / full_strategy generated for handoff | ☐ |
| S9 | Generate Campaign from approved plan | Brand resolve OK; lines + assignments + provenance | ☐ |
| S10 | Campaign Workspace open | Assignments / Deliverables / Media Plan / Client IO tabs load | ☐ |
| S11 | Client IO tip chrome | Load tip; no crash (send only if OPS-EMAIL green) | ☐ |
| S12 | Vendor IO / one-click approval path | Chrome loads; token path not 500 | ☐ |
| S13 | Quotation convert (if flag ON) | Creates campaign+assignments only; never auto CIO | ☐ |
| S14 | Worker heartbeat | Fresh; queues not stuck on localhost Redis | ☐ |

---

## 7. Post-deployment validation checklist

| # | Validation | Expect | ☐ |
|---|---|---|---|
| V1 | Migration versions 1–13 recorded applied on Prod | All present | ☐ |
| V2 | Ops Center aligned 15+ minutes | No drift | ☐ |
| V3 | `/api/health` + `/api/ready` | Pass | ☐ |
| V4 | Error rate (Vercel / logs) | No new 5xx spike vs baseline | ☐ |
| V5 | Studio CIP pipeline | Completions succeed; no systemic `discoveryTotal: 0` for healthy inventory markets | ☐ |
| V6 | One end-to-end handoff on Prod fixture (optional if S8–S9 done) | Header + lines + assignments + provenance | ☐ |
| V7 | CRM activation count | Stable if writers OFF | ☐ |
| V8 | Redis latency / worker | Heartbeat fresh; no drain stall | ☐ |
| V9 | Tag `v2.3.0` | Created only after smoke pass | ☐ |
| V10 | Continuity / release docs updated | Prod tip + deploy ID recorded | ☐ |

---

## 8. Production monitoring checklist

Watch for **at least 30–60 minutes** post-promote; extend if Studio soak continues.

| Signal | Source | Alert if |
|---|---|---|
| Ops Center overall health | `/operations` | Mismatch env/Supabase/SHA |
| App 5xx / function errors | Vercel logs | Sustained spike |
| Studio / CIP failures | App logs · CIP error tables | Repeated extract/slate failures |
| Discovery worker heartbeat | Redis `thinkway:worker:discovery:heartbeat` | Stale |
| Queue depth | BullMQ / Ops | Growing without drain |
| Auth / RLS denials | Supabase logs | Sudden lockout pattern |
| IO email delivery | Provider + `io_notifications` | Failures if send exercised |
| ECI bundle load latency | App timing | p95 regression blocking Studio |

---

## 9. Known residual Medium issues (non-blocking)

Accepted for Production with this package — **not** release blockers. Track into **Release 2.4** / inventory hygiene unless they become Critical in Prod.

| ID | Severity | Area | Notes |
|---|---|---|---|
| R23-M01 | Medium | Inventory | Thin Tech nano inventory → short excellent slates preferred (by design after FIT floor); may look “small” vs Fashion/Beauty |
| R23-M02 | Medium | CIP | Occasional CIP `discoveryTotal: 0` on weak/empty pools — monitor; not systemic on soak brands |
| R23-M03 | Medium | Data hygiene | Handle / geo inventory noise can still surface in edge creators — constraint engine mitigates mandatory country/platform |
| R23-M04 | Medium | Infra (carry-forward) | R2.2 **OPS-EMAIL**: Production email secrets were historically missing — verify before declaring Client IO send Complete (§3 E12) |
| R23-M05 | Low/Med | UX | Some Discovery/Studio empty states remain inventory-honest (“—” / short slate) rather than padded — intentional |

**Open Critical / High product defects:** None at Product Acceptance tip `027bf2ef`.

---

## 10. Release notes

### Thinkway Release 2.3 — Enterprise Planning & Creator Intelligence

**Release tip:** `027bf2ef`  
**Accepted on Development:** 2026-08-03 (Product Readiness ≥96)

Release 2.3 delivers the enterprise planning spine: Studio as the Planning Platform, Enterprise Creator Intelligence as the investment SSOT, Document Lifecycle + Change Impact as shared engines, and a production-quality Planning → Approval → Freeze → Campaign Workspace handoff.

**Highlights**

- Enterprise Creator Intelligence (Sprints 1–6) — historical → commercial → category/brand → performance → audience → investment; SSOT `loadCreatorIntelligenceBundle`
- Discovery consumers show **Investment** scores from ECI (Thinkway Score remains acquisition ranking only)
- Enterprise Constraint Engine — mandatory country/platform/language/safety never relaxed
- Studio Evolution + Enterprise Planning Package — Decision Narrative + single Planning Narrative SSOT
- Product QA hardening — category Criteria fidelity, why-selected integrity, FIT≥60 floor, confidence capped to evidence, handoff auto media plan + brand resolve

**What did not change**

- No parallel Planning Workspace product  
- No Media Plan ownership redesign  
- No invoice billing-engine execution against CIO milestones (still deferred)  
- Frozen packages remain Maintenance Mode after ship  

---

## 11. User-facing changes

| Surface | Change |
|---|---|
| Discovery cards / detail / compare | **Investment score** from ECI (or honest empty), not Thinkway-as-investment |
| Campaign Studio | Stronger category-fit slates; explicit why-selected; refuses weak all-below-floor slates |
| Studio Criteria | Vertical Criteria respected; negated categories (e.g. “do not pad with Food”) ignored as positives |
| Planning Confidence | Aligns with slate evidence (Moderate when mixed; not overstated) |
| Approval / Freeze / Generate Campaign | Reliable handoff into Campaign Workspace with lines, assignments, provenance |
| Campaign Workspace | Continues as execution home (unchanged ownership); opens cleanly from handoff |
| Client / Vendor IO | Lifecycle + one-click approval hardening (ops-facing) |

---

## 12. Internal technical changes

| Area | Change |
|---|---|
| `lib/enterprise-creator-intelligence/` | Protected ECI package + 6 sprint schemas |
| `lib/document-lifecycle/` · `lib/change-impact/` | Frozen engines; CIO/VIO first consumers |
| `lib/discovery/enterprise-constraint-engine.ts` | Mandatory vs preferred constraint split |
| `features/campaign-studio/` | Planning narrative · ECI consume-only · slate quality · Director finalize outputs |
| `features/campaign-intelligence/` | Section builders preserve why-selected; exec summary confidence capped |
| `features/ai/tools/campaign-search-intent.ts` | Negated category mentions ignored |
| Handoff | `ensurePlanningOutputsForHandoff`; brand resolve from campaign facts; `current_version` on object head |
| Migrations | 13 additive SQL files (§2) |
| Tests | Constraint engine · slate FIT · intent · handoff unit coverage on develop tip |

---

## 13. Production risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration order / enum visibility mistake | Low | High | Strict §2 order; verify after each engine step |
| Accidental Dev DB write | Low | Critical | `psql-production.mjs` ref guard; spoken confirmation of `ienowhwfyxoqtzbgltno` |
| Env mismatch (Prod app → Dev Supabase) | Low | Critical | Ops Center gate; abort + rollback on mismatch |
| ECI empty on day-1 Prod | Medium | Low/Med | Honest empty UI; optional enrichment backfill post-ship (not blocking) |
| Studio slate quality variance on thin markets | Medium | Medium | FIT floor + refuse-weak; short excellent slate preferred (accepted) |
| CIP intermittent empty discovery | Medium | Medium | Monitor R23-M02; Critical only if systemic |
| IO email still broken (OPS-EMAIL) | Medium | Medium | Verify secrets before customer send; do not block app deploy if Product scopes smoke without send |
| Large 93-commit promote | Medium | Medium | Smoke S1–S14; prefer staged promote (`--skip-domain` then alias) if Product wants extra hold |
| Uncommitted Wave 1 accidentally included | Low | High | Release tip = `027bf2ef` only; exclude local discovery work |
| CRM writers left ON | Low | High | Explicit `CREATOR_CRM_WRITERS_ENABLED=false` on Prod unless approved |

---

## Product Acceptance evidence (Development — already passed)

| Campaign | Criteria | avgFit | why-selected | Notes |
|---|---|---|---|---|
| L'Oréal | Beauty | 77 | 10/10 | Handoff E2E → **TW-2026-0006** |
| Trendyol | Fashion | 76 | 10/10 | |
| Formula 1 | Automotive/Sports | 73 | 5/5 | |
| Liwa Festival | Travel | 75 | 5/5 | |
| Noon | Lifestyle | 76 | 5/5 | Retail-justified |
| e& Egypt | Tech | 73–76 | 3–5 | Short excellent slate |

**Handoff proof:** conversation `d9fe7c1d-15dd-4e73-a2f3-baf44f59d673` → campaign object `935ea37a-51b5-44ac-a539-c8d1af1c8dd9` approved v12 → **TW-2026-0006** (`08a1efd0-f603-488d-99f1-19fb237d4802`) · 10 lines · 10 assignments · provenance OK.

---

## Approval block (Product)

> **Production deployment is not authorized by this package alone.**

To authorize, Product should reply with explicit approval that includes at minimum:

1. Approved tip SHA: `027bf2ef` (or named Critical hotfix)  
2. Approval to apply **13** migrations on Production `ienowhwfyxoqtzbgltno`  
3. Approval to merge `develop` → `main` and deploy `app.thinkwaymedia.com`  
4. Convert / CRM flag intents confirmed (§4)  
5. Whether Client IO **send** smoke is in-scope (depends on OPS-EMAIL)

Until then: **Release 2.3 remains in Maintenance Mode on Development only.**  
**Next active initiative after Production approval + closure:** **Release 2.4.**
