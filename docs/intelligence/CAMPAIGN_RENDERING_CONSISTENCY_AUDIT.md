# Campaign Rendering Consistency Audit — Studio · Presentation · PDF · PowerPoint

**Date:** 2026-07-14
**Scope:** Every campaign fact rendered by the four output surfaces of Campaign Intelligence, traced to its source, with divergences identified **before** remediation.
**Relation to prior audits:** Extends `CAMPAIGN_FACTS_DEPENDENCY_AUDIT.md` (2026-07-04). Since that audit, a partial facts bridge (`features/campaign-director/facts/facts-display-bridge.ts`) was wired into the shared resolver. This audit reflects the **current** state and covers the export surfaces the prior audit did not.

---

## 1. Surface inventory

| Surface | Entry point | Read path |
|---------|------------|-----------|
| **Studio** | `features/campaign-studio/components/campaign-studio.tsx` → 17 section cards | `enrichCampaignObjectWithStudioData` (studio-section-data-builders.ts) → `section-data-resolver.ts` → section components |
| **Presentation** | `presentation-status-section.tsx` (approval/export card) + executive summary section | `resolvePresentationData` / `resolvePresentationCompletion` / `resolveExecutiveSummaryData` |
| **PDF** | `features/campaign-studio/export/campaign-proposal-document.ts` (`buildCampaignProposalDocumentHtml` → browser print) | Same resolvers as Studio + `useCreatorHydration` vendors |
| **PowerPoint** | **Does not exist.** `Export PPT` button (`presentation-status-section.tsx:173-176`) has no `onClick` — dead stub | — |

Positive baseline: Studio and PDF already share one read path (`section-data-resolver.ts`). The risk is not divergent readers — it is that the shared path silently falls back to ~2,100 lines of hardcoded industry template content (`presentation-intelligence.ts`, `industry-intelligence.ts`) and brand-keyed demo reasoning (`reasoning/kpi-reasoning.ts` et al.), which then renders as if campaign-derived on every surface.

---

## 2. Field × surface matrix (pre-remediation)

Legend: ✅ facts/Campaign-Object-derived · ⚠️ conditional bypass · ❌ hardcoded template / fabricated · — not rendered

| Field | Studio | Presentation | PDF export | PPTX | Divergence |
|-------|--------|--------------|-----------|------|------------|
| Brand / client | ✅ facts-first (`applyFactsToSummaryData`; `resolvePresentationData`) ⚠️ legacy regex fallback `parseBrandFromText` / `resolveClientFromBrief` incl. hardcoded `Coca-Cola\|BabyJoy\|…\|Pepsi` list, default **"Brand Client"** | ✅/⚠️ same | ⚠️ `presentation?.brandName ?? summary?.brand ?? "Campaign"`; **"Brand Client"** can print on cover | — | D1 |
| Budget total + currency | ✅ facts-first in `resolveBudgetData` | ✅ via same | ✅ same resolver; fallback string "Budget to be confirmed with client." | — | ok |
| **Duration** | ⚠️ **three competing authorities**: `resolveTimelineData` prefers approved activation timeline, then facts, then summary-cards parse, then text; `summaryCards.duration` uses facts **only if facts exist**, else free-text parse; `deriveContentPlan`/`deriveWhyAiInsights`/`deriveExecutiveSummary`/`deriveSuccessProbability` each **re-parse text** via `parseDurationWeeks(combined)` | ⚠️ `deriveExecutiveSummary` re-parses text | ⚠️ inherits whichever section it quotes | — | **D2 — release blocker.** Summary card can say "6 weeks" while content plan / exec summary computed from a stray "10 weeks" in LLM prose |
| **Creative concepts** | ❌ `deriveCreativeConcepts` returns **industry demo templates** (`CONCEPT_TEMPLATES`, L81-277 presentation-intelligence.ts) with baked-in demo brands (BabyJoy/Adidas captions patched by `.replace()`), Egypt-specific tourism copy, fixed hashtags — regardless of the actual proposed campaign | — | **not included** (export omits concepts entirely) | — | **D3 — release blocker.** Studio shows generic concepts; the client proposal shows none |
| **Estimated reach** | ❌ `INDUSTRY_PROFILES[*].estimatedReach` hardcoded ranges ("2.5M–4M qualified impressions", "8M–15M campaign impressions"…), scaled by a regex ×2 / ×0.6 duration hack (`getIndustryProfile` L173-177); rendered in Campaign Summary card and Industry Benchmark | ❌ `deriveExecutiveSummary.expectedBusinessOutcome` embeds the same range | ⚠️ leaks via executive summary text | — | **D4 — release blocker.** Never derived from the selected creator slate; no assumptions documented |
| KPIs / success metrics | ⚠️ precedence: IS-1 `kpiReasoning` (brand-keyed **demo templates** for BabyJoy/Coca-Cola with internal notes: `"CampaignFacts.objective=…"`, `"…— rejected"` alternatives) → stored grounded → facts KPIs → **fabricated** `getGroundedKpis` ("Based on 47 similar luxury campaigns", "124 baby FMCG campaigns" — invented counts) | ⚠️ same | **not included** — proposal has **no KPI/success-metrics page at all** | — | **D5/D6 — release blockers.** No client-suitable KPI framework exists; Studio shows internal reasoning + fabricated evidence |
| Creator mix | ⚠️ IS-1 reasoning tiers → facts mix → ❌ `MIX_BY_INDUSTRY` templates. Luxury template includes **Celebrity 15%** unconditionally | — | **not included** | — | **D7 — release blocker.** Celebrity tier renders with no celebrity selected; luxury exec-summary text says "macro and celebrity creators" |
| Celebrity references | ❌ `MIX_BY_INDUSTRY.luxury`, `deriveExecutiveSummary.luxury` ("celebrity creators"), `deriveOpportunities.luxury` ("Add 1 celebrity ambassador"), `INDUSTRY_PROFILES.luxury.creatorMixSummary` ("Macro + Celebrity") | ❌ same | ⚠️ via exec summary | — | D7 |
| Timeline weeks | ✅ approved activation timeline → facts → ⚠️ industry phase templates | — | **not included** | — | D2 |
| Creator slate | ✅ real IDs + hydration (`useCreatorHydration`) | ✅ counts | ✅ hydrated table | — | ok |
| Executive summary | ❌ per-industry canned sentences (`deriveExecutiveSummary` L1105-1112) + hardcoded reach + `"Thinkway campaign database"` grounding claims | ❌ same | ❌ prints `executive?.summary` verbatim | — | D4/D8 |
| Why-AI / opportunities / success probability | ❌ fabricated evidence ("47 luxury campaigns · avg fit score 87/100", "save rate 8.2%", invented approval-cycle day counts); `"verification pending without CampaignFacts"` | — | not included | — | D8 (internal leak class) |
| Industry benchmark | ⚠️ literal **"Verification required"** cells (`getIndustryBenchmarks`) | — | not included | — | D8 |
| Placeholder strings reachable in client exports | — | — | ❌ "Brand Client" (cover), "Campaign proposal prepared by Thinkway AI.", "Strategy aligned to brief objectives and audience.", "No recommended creators yet — run discovery first.", exec-summary fabrications | — | **D8 — release blocker** |

---

## 3. Divergence register (release blockers)

| # | Divergence | Root cause | Files |
|---|-----------|-----------|-------|
| **D1** | Brand can render as "Brand Client" / wrong brand on legacy objects; PDF cover prints it | Hardcoded brand regex fallback; export does not treat placeholder as absent | `industry-intelligence.ts:180-192`, `campaign-proposal-document.ts:44` |
| **D2** | Duration has ≥4 independent resolution paths; summary card, timeline, content plan, and executive summary can disagree | `parseDurationWeeks(combined)` re-parses free text in 5 call sites instead of one authority | `presentation-intelligence.ts:453,474,958,1102`, `timeline-duration.ts`, `section-data-resolver.ts:772-779` |
| **D3** | Creative Concepts renders generic industry demo templates, not the proposed campaign's concepts; concepts absent from exports | `CONCEPT_TEMPLATES` / `CONCEPT_ENHANCEMENTS` industry library; demo-brand caption `.replace("BabyJoy", brand)` | `presentation-intelligence.ts:81-342`, `studio-section-data-builders.ts:322,524-525` |
| **D4** | Reach is a hardcoded industry range mutated by regex, never computed from the selected slate; no assumptions shown | `INDUSTRY_PROFILES[*].estimatedReach` + `getIndustryProfile` scaling hack | `industry-intelligence.ts:64-178`, `studio-section-data-builders.ts:270`, `presentation-intelligence.ts:1134-1136` |
| **D5** | Exports contain internal AI reasoning risk (exec-summary "Thinkway campaign database" grounding; KPI reasoning strings `"CampaignFacts.x="`, `"— rejected"` when surfaced) and placeholders | No client-safe sanitation layer between resolvers and exports | `campaign-proposal-document.ts`, `reasoning/kpi-reasoning.ts`, `presentation-intelligence.ts` |
| **D6** | No client-suitable Success-Metrics/KPI page: Studio KPI card shows internal sensitivity/rejected-alternative reasoning or fabricated benchmark counts; PDF has no KPI section | `getGroundedKpis` fabricated `similarCampaigns`; export omits KPIs | `industry-intelligence.ts:662-739`, export |
| **D7** | Celebrity references render with no celebrity selected (luxury mix 15% Celebrity, "celebrity creators" prose, "Add 1 celebrity ambassador" opportunity) | Industry templates unconditioned on slate | `presentation-intelligence.ts:344-351,1106,1049`, `industry-intelligence.ts:69` |
| **D8** | Fabricated evidence ("47/83/124/156/38/62 historical campaigns", invented ER/ROAS/CTR stats) and "Verification required"/"verification pending" strings presented as grounding | Static template libraries masquerading as data | `industry-intelligence.ts`, `presentation-intelligence.ts:466-567` |
| **D9** | PowerPoint export advertised in UI but not implemented — guaranteed inconsistency (no output at all) | Unwired button | `presentation-status-section.tsx:173-176` |

---

## 4. Remediation design (implemented in this change)

**Principle:** one canonical, client-safe **campaign render model** derived from the CampaignObject (+ hydrated creator slate), consumed by Studio resolvers, the Presentation card, the PDF document, and a new PPTX generator. Facts SSOT (`meta.campaignFacts`) wins wherever present.

| Fix | Mechanism |
|-----|-----------|
| Duration (D2) | `resolveCampaignObjectDurationWeeks(campaignObject)` in `campaign-render-model.ts` is the **only** authority (facts → approved activation timeline → summary cards → text → default). All former `parseDurationWeeks(combined)` call sites now receive the resolved value as a parameter. |
| Creative concepts (D3) | `CONCEPT_TEMPLATES`/`CONCEPT_ENHANCEMENTS` deleted. Concepts precedence: persisted concepts on the Campaign Object → concepts built from the campaign's own facts/strategy (brand, objective, audience, platforms, key messages — no demo brands, no industry boilerplate). Exports render actual concepts or omit the section. |
| Reach (D4) | `estimateSlateReach(vendors, durationWeeks)` computes reach from the selected slate's follower base with platform view-rate assumptions, and returns the assumption list rendered alongside. No slate → "Pending creator selection", never a fabricated range. `INDUSTRY_PROFILES.estimatedReach` removed. |
| Client-safe exports (D5, D8) | `sanitizeClientFacingText` + banned-token guard applied to every string entering PDF/PPTX; internal grounding/evidence fields are never exported; regression test asserts a banned-token list (`TBD`, `Verification required`, `verification pending`, `CampaignFacts`, `SSOT`, `Brand Client`, `rejected`, `historical campaigns`, demo brands foreign to the campaign) is absent from both exports. |
| KPI framework (D6) | `buildKpiFramework(campaignObject)` produces a professional client framework (metric · target · what it measures · measurement source) from approved KPI reasoning / facts KPIs, sanitized. Rendered as a "Measurement & KPI Framework" page in PDF and a slide in PPTX. Fabricated `similarCampaigns` counts removed from `getGroundedKpis`. |
| Celebrity gating (D7) | `resolveCelebrityAllowed(campaignObject, vendors)`: celebrity content allowed only if the selected slate contains a Celebrity-tier creator (follower/role based) or the brief/facts explicitly request one. `filterCelebrityFromMix` renormalizes tiers; prose builders take the gate. |
| Synchronized sections (D2/D4/D7) | Strategy, timeline, budget, creator mix, executive summary all read the same render model values (duration, budget, brand, mix, reach). |
| PPTX (D9) | New `campaign-proposal-slides.ts` (pure slide model from the render model — testable) + `campaign-proposal-pptx.ts` (pptxgenjs renderer) wired to the Export PPT button. PDF rebuilt on the same slide/render model, so PDF ≡ PPTX ≡ Studio by construction. |
| Regression tests | `campaign-render-model.test.ts` + `campaign-proposal-consistency.test.ts` (npm script `test:campaign-render-consistency`) assert: single duration everywhere; slate-derived reach with assumptions; actual concepts; celebrity absence when not selected; banned tokens absent; PDF/PPTX/Studio field equality on a fixture campaign. |

## 5. Verification (post-remediation)

| Check | Command | Result |
|-------|---------|--------|
| Render-model unit tests (reach math, celebrity gate, sanitizer, KPI framework) | `npx tsx features/campaign-studio/services/campaign-render-model.test.ts` | PASS |
| Cross-surface consistency regression (duration/concepts/reach/celebrity/banned tokens/KPI page/PDF≡PPTX) | `npx tsx features/campaign-studio/export/campaign-proposal-consistency.test.ts` | PASS |
| Combined script | `npm run test:campaign-render-consistency` | PASS |
| Existing timeline duration suite | `npx tsx features/campaign-studio/services/timeline-duration.test.ts` | PASS |
| Existing budget allocation suite | `npx tsx features/campaign-studio/services/budget-allocation.test.ts` | PASS |
| Director budget rules | `npx tsx features/campaign-director/services/budget-rules.test.ts` | PASS |
| Campaign intelligence parser suite | `npm run test:campaign-intelligence` | PASS |
| Type check | `npx tsc --noEmit` | PASS |
| ERS-3 resolver purity (no cross-section derivation helpers in resolver source) | grep per `validate-ers3-campaign-object-integrity.ts` rules | CLEAN |

The regression fixture ("Nile Fresh", EGP 2,000,000, 8 weeks, Instagram+TikTok, 3-creator slate) deliberately plants a conflicting "10 weeks" mention in the summary narrative and asserts the facts SSOT wins on every surface; it also asserts the banned-token list (TBD, Verification required/pending, CampaignFacts, SSOT, Brand Client, historical campaigns, demo brands, "prepared by Thinkway AI", "run discovery") never appears in the PDF HTML or the PPTX slide model.

---

**Out of scope (unchanged behavior, documented):** industry benchmark Studio card retains its explicit "Verification required" cells (internal analyst aid — not exported); the LLM/Director generation pipeline (`section-updaters.ts`, `continuation.ts`) and the brand-keyed IS-1 reasoning templates (`reasoning/kpi-reasoning.ts` BabyJoy/Coca-Cola narratives — generation-side, Studio-internal, sanitized before any export) are untouched pending the full SSOT migration; Knowledge Center work deferred until this remediation is verified, per release plan.
