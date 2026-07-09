# Release 1.1.5 — Director Output Wiring Report

**Date:** 2026-07-05  
**Scope:** Wire Campaign Studio sections to approved Director output (P0–P3 audit findings)  
**Verdict:** **Do NOT claim PASS** — manual QA required before sign-off

---

## Summary

Implemented approved-data-first precedence across all 9 Campaign Studio intelligence sections. Legacy `presentation-intelligence` derive paths remain as fallbacks only when approved `sections.*.data` is missing or for legacy campaigns without `meta.campaignFacts` / director pipeline.

**Sections migrated:** 9 / 9  
**Automated validation:** 80 / 80 checks passed (5 fallback paths documented)  
**Build:** `npm run build` — success  
**Typecheck:** `npx tsc --noEmit` — success

---

## Files Changed

| File | Change |
|------|--------|
| `features/campaign-studio/services/section-data-resolver.ts` | Approved-data-first resolvers; wired dead exports; mapping helpers |
| `features/campaign-intelligence/services/studio-section-data-builders.ts` | Enrich guards — skip legacy derive when approved fields present |
| `features/campaign-studio/components/sections/executive-strategy-section.tsx` | Wire `resolveExecutiveStrategyReasoning` |
| `features/campaign-studio/components/sections/why-ai-section.tsx` | Wire `resolveDirectorDecisionMinutes` |
| `features/campaign-studio/components/sections/risk-analysis-section.tsx` | Director risks first; enriched supplemental |
| `features/campaign-studio/components/sections/vendor-discovery-section.tsx` | IS-2 `database` stage label support |
| `features/campaign-studio/components/sections/budget-planner-section.tsx` | Surface `budgetPlannerReasoning` |
| `scripts/validate-release-1-1-5-wiring.mjs` | New validation script (5 fixtures) |
| `docs/release/release-1-1-5-wiring-validation-results.json` | Machine-readable validation output |

---

## Sections Migrated

| # | Section | Approved Source | Resolver / Component Change |
|---|---------|-----------------|------------------------------|
| 1 | Executive Strategy | `strategy.data.executiveStrategyReasoning` | `executiveStrategyReasoningToFields()` + component wiring |
| 2 | Vendor Discovery | `creators.data.vendorDiscoveryFunnel` | Verbatim funnel when present (9 IS-2 stages) |
| 3 | Vendor Recommendations | `recommendations.selectedReasoning` | `resolveVendorGrounding` prefers IS-1 minutes |
| 4 | Budget Planner | `budget.data.allocationReasoning` / `budgetPlannerReasoning` | Resolver + UI director rationale badge |
| 5 | Timeline | `timeline.data.creatorActivationTimeline` | `activationTimelineToWeeks()` preferred over generic phases |
| 6 | Creator Mix | `strategy.data.creatorMix` | Approved mix always wins over `buildCreatorMixFromFacts` |
| 7 | KPI Forecast | `performance.data.kpiReasoning` | `kpiReasoningToGrounded()` before facts/industry |
| 8 | Risk Analysis | `operations.content.risks` | Component renders director risks first |
| 9 | Thinkway Decision Rationale | `strategy.data.directorDecisionMinutes` | `directorDecisionMinutesToInsights()` wired in why-ai |

---

## Legacy Paths Removed / Demoted

| Legacy Path | Status |
|-------------|--------|
| `deriveGroundedStrategy` overwrite when `executiveStrategyReasoning` present | **Skipped** in enrich |
| `deriveWhyAiInsights` overwrite when `directorDecisionMinutes` present | **Skipped** in enrich |
| `buildCreatorMixFromFacts` when approved `creatorMix` exists | **Skipped** in enrich + resolver |
| `buildGroundedKpisFromFacts` / `getGroundedKpis` when `kpiReasoning` present | **Skipped** in enrich; resolver prefers reasoning |
| `getBudgetAllocationReason` when `allocationReasoning` present | **Skipped** in enrich; resolver maps reasoning |
| `buildTimelineWeeksForCampaign` when `creatorActivationTimeline` present | **Skipped** in enrich; resolver converts activation weeks |
| `resolveDiscoveryPipeline` 6-stage rebuild when `vendorDiscoveryFunnel` present | **Bypassed** — verbatim funnel |
| `deriveVendorRankingFactors` when `selectedReasoning` present | **Demoted** — IS-1 whySelected primary |
| `getIndustryRisks` / `enrichedRisks` precedence over director risks | **Demoted** — director risks render first |
| Dead resolver `resolveDirectorDecisionMinutes` | **Wired** to why-ai section |
| Dead resolver `resolveExecutiveStrategyReasoning` | **Wired** to executive-strategy section |

---

## Remaining Fallbacks (Expected)

| Section | Fallback Condition |
|---------|-------------------|
| Executive Strategy | No `executiveStrategyReasoning` → `groundedFields` from `deriveGroundedStrategy` |
| Vendor Discovery | No `vendorDiscoveryFunnel` → 6-stage `DISCOVERY_PIPELINE_STAGE_DEFS` rebuild |
| Vendor Recommendations | No `selectedReasoning` → `deriveVendorRankingFactors` / stored `vendorGrounding` |
| Budget Planner | No `allocationReasoning` → `getBudgetAllocationReason` industry templates |
| Timeline | No `creatorActivationTimeline` → `buildTimelineWeeksForCampaign` industry phases |
| Creator Mix | No approved `creatorMix` + facts present → `buildCreatorMixFromFacts` |
| KPI Forecast | No `kpiReasoning` / `groundedKpis` → `buildGroundedKpisFromFacts` |
| Risk Analysis | No director `operations.content.risks` → `enrichedRisks` / `buildRiskAnalysisFromBudget` |
| Decision Rationale | No `directorDecisionMinutes` → `whyAiInsights` from `deriveWhyAiInsights` |

**Validation note:** All 5 fixtures exercised vendor recommendations fallback (no shortlist creators in mock pipeline). Live campaigns with shortlist task output will use `selectedReasoning`.

---

## Validation Results

**Script:** `npx tsx scripts/validate-release-1-1-5-wiring.mjs`  
**Fixtures:** BabyJoy, Coca-Cola, Tourism Egypt, Samsung, L'Oréal  
**Results:** `docs/release/release-1-1-5-wiring-validation-results.json`

| Fixture | Checks | Fallbacks Documented |
|---------|--------|---------------------|
| BabyJoy | 16/16 | Vendor recommendations (no shortlist) |
| Coca-Cola | 16/16 | Vendor recommendations (no shortlist) |
| Tourism Egypt | 16/16 | Vendor recommendations (no shortlist) |
| Samsung | 16/16 | Vendor recommendations (no shortlist) |
| L'Oréal | 16/16 | Vendor recommendations (no shortlist) |

---

## Manual QA Required

| Check | Status |
|-------|--------|
| Studio renders debate winner content (not industry templates) | Automated resolver checks pass — **human sign-off required** |
| Live shortlist populates vendor `selectedReasoning` render path | Not covered by mock pipeline fixtures |
| ERS-3 legacy path campaigns still render (fallback) | Not regression-tested in this release |
| Visual review of all 9 sections in Campaign Studio UI | **Pending** |

---

## Related Artifacts

- Audit: `docs/intelligence/END_TO_END_PIPELINE_AUDIT.md`
- Raw audit: `docs/intelligence/END_TO_END_AUDIT_RAW.json`
- Validation JSON: `docs/release/release-1-1-5-wiring-validation-results.json`

---

*End of Release 1.1.5 Director Output Wiring Report*
