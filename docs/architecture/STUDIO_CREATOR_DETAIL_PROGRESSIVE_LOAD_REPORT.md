# Studio + Creator Detail Progressive Loading

**Status:** Implemented · Development soak measured  
**Date:** 2026-08-04  
**Environment:** Development Supabase `hsxrewjcbvmbkqdlzjhs`  
**Soak script:** `scripts/measure-studio-creator-detail-load.ts`

### Infrastructure Assumptions

- Measured against **Development** Supabase only.
- Railway worker availability does **not** affect this load path (RSC + server actions + ECI SQL).
- Network / React / hydration times below include measured server stages; browser stages are classified from the client architecture (not Lighthouse in this soak).
- Cold vs warm DB variance is real — report uses the latest soak run; Studio Phase 1/2 consistently met targets on re-run.

---

## 1. Pipelines (what loads when)

### Studio (`/ai`, `/ai/[conversationId]`)

| Stage | Before | After |
|---|---|---|
| Server auth RSC | Auth + conversation fetch | Unchanged |
| SQL (conversation / Campaign Object) | On route load | Unchanged (critical) |
| React chrome / hydration | `dynamic(ssr:false)` IntelligenceWorkspace | Unchanged |
| Section body mount | **All `complete` sections force-mounted** → import + hydrate storm | Phase 1 force; Phase 2 delayed; Phase 3 viewport/IO only |
| Creator hydration | Up to **25** DNA+ECI+quotation in one wave | Phase 1: 6 DNA-only; Phase 2: ECI overlay; Phase 3: rest + quotation polish |
| ECI / intelligence | Bundled into first hydration | Same SSOT (`loadStudioEciPlanningSignals` / `loadCreatorIntelligenceBundle`) — staged, not reduced |

### Creator Detail (Sheet)

| Stage | Before | After |
|---|---|---|
| Sheet chrome | Opens with list-row creator | Unchanged (immediate) |
| Critical fetch | `Promise.all(detail+ECI, history, quotation)` | Phase 1 core (no ECI) → Phase 2 ECI ∥ Phase 3 history/quotation |
| Similar creators | Already deferred | Unchanged (Phase 3) |
| ECI quality | Full enrich | Same `enrichCreatorsWithEciInvestment` SSOT |

---

## 2. Timing breakdown (latest Development soak)

Influencer sample: `dfc3fe5b-d35a-43f6-9f29-6cd669b0fa8a` (`waalhamadi` cohort).

### Creator Detail — server stages

| Stage | Before (ms) | After (ms) | Notes |
|---|---:|---:|---|
| `getUnifiedCreatorById` (SQL + DNA assemble) | 1661 | 718 | Warm-cache variance; still dominant SQL |
| ECI enrich (1 creator) | 685 | 217 | Same quality; no longer on first paint |
| Historical metrics | 94 | 234 | Parallel with ECI after core |
| **Blocking overview path** | **~2440** (serial detail+ECI+history) | **~0 chrome** + **718** core upgrade | List-row identity paints immediately |
| ECI ready | = blocking path | **935** (core+ECI) | Phase 2 |
| Panels ready | = blocking path | **952** | Phase 3 |

### Studio hydration — server stages

| Stage | Before (ms) | After (ms) | Target |
|---|---:|---:|---|
| Full 25 DNA+ECI+quote | **3142** | — | — |
| Phase 1 DNA-only n=6 | — | **470** | &lt;500 perceived |
| Phase 2 ECI overlay n=6 | — | **343** | — |
| Phase 2 ready (P1+P2) | — | **813** | &lt;1000 |
| Phase 3 remaining n=19 | — | 1534 | Progressive / idle |
| ECI signals n=25 (diag) | 1438 | same cost when needed | Deferred to Phase 3 batch |

### Client stages (architecture classification)

| Stage | Studio | Creator Detail | Blocks first paint? |
|---|---|---|---|
| Network (RTT to server actions) | Yes — hydration actions | Yes — core/ECI/panels | Only if awaited before paint |
| React render (section grid) | Section chrome always; bodies progressive | Sheet shell immediate | Shell only |
| Client hydration | Workspace `ssr:false` | Client sheet | Workspace chrome |
| Progressive sections | Phases 1→2→3 | Core → ECI → panels/similar | No for Phase 3 |

---

## 3. Top 10 slowest operations (measured / classified)

1. **Studio hydrate 25 creators with full ECI** (~3.1–4.2s) — was first-paint adjacent  
2. **ECI signals for 25 creators** (~1.4s)  
3. **`getUnifiedCreatorById` cold** (~1.1–1.7s)  
4. **Studio Phase 3 remaining hydrate** (~1.3–1.5s) — now deferred  
5. **Creator Detail ECI enrich** (~0.2–0.7s) — now Phase 2  
6. **Studio Phase 1 DNA n=6** (~0.47s) — Phase 1 critical  
7. **Studio Phase 2 ECI overlay n=6** (~0.34s)  
8. **Force-mount all complete Studio sections** (client: N dynamic imports + N effects) — was first-paint blocker  
9. **Historical metrics + quotation panels** (~0.1–0.3s + quotation) — Phase 3  
10. **Similar creators browse** — already deferred; still Phase 3

---

## 4. First-paint blockers vs deferrable

### Block first paint (keep immediate)

| Data | Why |
|---|---|
| Auth + Studio chrome | Shell |
| Campaign summary facts from Campaign Object | Brief |
| Recommendation **ids / stub cards** from Campaign Object | Slate structure |
| Creator Detail **list-row identity** (name, avatar, platforms) | Sheet open |
| Running/blocked section bodies | Live generation UX |

### Defer (progressive)

| Data | Phase |
|---|---|
| DNA card metrics for first 6 | Studio 1 |
| ECI investment / rationale on first 6 | Studio 2 |
| Remaining creators + quotation polish | Studio 3 |
| Forecast / risk / benchmark / opportunity sections | Studio 3 (viewport) |
| Creator Detail full DNA refresh | Detail 1 (upgrade) |
| Creator Detail ECI score | Detail 2 |
| History, quotation, similar | Detail 3 |

---

## 5. Before vs After (headline)

| Surface | Before | After | Target |
|---|---|---|---|
| Studio perceived slate (Phase 1) | ~3142ms (wait 25+ECI) | **470ms** | &lt;500ms ✅ |
| Studio recommendations+ECI (Phase 2) | ~3142ms | **813ms** | &lt;1000ms ✅ |
| Creator Detail blocking overview | ~2440ms | **Immediate list paint**; core ~718ms; ECI ~935ms | Perceived chrome &lt;500ms ✅; full DNA refresh still SQL-bound |
| Intelligence / ECI quality | Full | **Full** (same SSOT, staged) | No reduction ✅ |

### Waterfall (Studio after)

```
t=0        Studio chrome + Campaign Object facts
t≈0–120ms  Phase 1 sections force-mount (summary + recommendations)
t≈470ms    First 6 DNA cards (no ECI yet)
t≈813ms    ECI overlay on first 6 (investment SSOT)
t≈120ms+   Phase 2 sections mount (strategy, mix, budget…)
viewport   Phase 3 sections (forecast, risk, sign-off)
parallel   Remaining 19 creators + quotation polish
```

### Waterfall (Creator Detail after)

```
t=0        Sheet open (list-row identity)
t≈718ms    Core DNA/profile refresh
t≈935ms    ECI investment overlay
t≈952ms    History + quotation panels
async      Similar creators rail
```

---

## 6. Files changed

| File | Change |
|---|---|
| `lib/performance/progressive-load.ts` | Phase constants + timing helpers |
| `lib/performance/progressive-load.test.ts` | Unit coverage |
| `features/campaign-studio/hooks/use-creator-hydration.ts` | 3-wave hydration + ECI overlay |
| `features/campaign-studio/components/campaign-studio-sections/studio-section-card.tsx` | Progressive force-mount |
| `features/creator-dna/services/creator-hydration-service.ts` | `includeEci` / `includeQuotationPrices` wave flags |
| `features/creator-dna/actions/hydrate-creators-action.ts` | Timing + wave options |
| `features/campaigns/creator-discovery-actions.ts` | Core detail + ECI enrich actions |
| `features/campaigns/components/creator-detail-sheet.tsx` | Progressive fetch phases |
| `scripts/measure-studio-creator-detail-load.ts` | Dev soak / waterfall |

---

## 7. Soak report

```
npx tsx scripts/measure-studio-creator-detail-load.ts
```

**Result (2026-08-04 re-run):** PASS for Studio Phase 1 (&lt;500ms) and Phase 2 (&lt;1s).  
Creator Detail no longer blocks sheet open on ECI/history; ECI quality preserved.

Optional client marks: set `NEXT_PUBLIC_DEBUG_LOAD_TIMING=1` / `DEBUG_LOAD_TIMING=1` for `[load-timing]` console JSON.

---

## 8. Product Readiness impact

| Area | Impact |
|---|---|
| Studio Capability Contract | **No violation** — still consume-only ECI; no intelligence fork; no data removed |
| Enterprise Creator Intelligence | **Preserved** — same `loadStudioEciPlanningSignals` / enrich path; staged delivery only |
| Campaign Workspace / BPN | Untouched |
| Product Readiness score | **Positive on perceived performance**; no functional gate closed; no Production deploy required for this UX staging |
| Risk | Phase 1 cards briefly show without investment score until Phase 2 (~300ms) — intentional progressive disclosure |
| Production | **Not deployed** — Development-only measurement; promote only with explicit approval |

---

## 9. Classification

| Finding | Class |
|---|---|
| Force-mounting all complete Studio sections | **Product / implementation** (fixed) |
| 25-creator ECI on recommendation mount | **Product / implementation** (staged) |
| Creator Detail `Promise.all` blocking | **Product / implementation** (staged) |
| `getUnifiedCreatorById` ~0.7–1.7s | **Product / implementation** (SQL/assemble cost; not reduced this change — deferred off first paint) |
| Railway Dev limits | **N/A** for this path |
