# Release 1.1.4 — Intelligence End-to-End Pipeline Audit

**Audit date:** 2026-07-05  
**Scope:** Verify intelligence pipeline reaches Campaign Studio — winning debate strategy → final rendered content  
**Mode:** Read-only audit — no application code modified  
**Auditor:** Release 1.1.4 subagent `8f625e55-c0cf-4c95-a28d-11b122473f03`

---

## Verdict

**Do NOT claim PASS.** Automated population checks (ERS-3) can show sections "filled" while **winning debate strategy content is bypassed at render time**. Manual review is required before any release sign-off.

Simulated comparison across BabyJoy, Coca-Cola, Tourism, Samsung, and L'Oréal yields **42 FAIL mismatches** (0 PASS claims).

---

## Pipeline Path (Canonical)

```mermaid
flowchart LR
  Brief[Campaign Brief] --> Facts[CampaignFacts SSOT]
  Facts --> BaseStrat[writeStrategyDocumentFromBrief]
  BaseStrat --> Debate[IS-3 Debate Engine]
  Debate --> Winner[applyWinnerOptionToStrategy]
  Winner --> Specialists[Specialist Dispatch + Workflow Tasks]
  Specialists --> Review[Cross Review + Challenge Loop]
  Review --> Approved[buildApprovedSections]
  Approved --> CO[CampaignObject sections + data]
  CO --> Enrich[enrichCampaignObjectWithStudioData]
  Enrich --> Resolver[section-data-resolver.ts]
  Resolver --> Studio[Campaign Studio SectionRenderer]
```

### Key integration points

| Stage | File | Function |
|-------|------|----------|
| Director pipeline write | `features/campaign-director/services/campaign-director.ts` | `runCampaignDirectorPipeline` → `buildApprovedSections` |
| Workflow merge | `features/campaign-director/integrations/workflow-integration.ts` | `applyDirectorPipelineToCampaignObject` (only when `approvalGate.approved`) |
| Post-task enrich | `features/campaign-intelligence/services/section-updaters.ts` | always calls `enrichCampaignObjectWithStudioData` |
| Studio render | `features/campaign-studio/components/sections/section-renderer.tsx` | dispatches to per-section components |

---

## Legacy Bypass Risk Summary (9 Sections)

| # | Studio Section | Legacy Bypass Risk | Root Cause |
|---|----------------|-------------------|------------|
| 1 | Executive Strategy | **CRITICAL** | UI reads `groundedFields` from `deriveGroundedStrategy()`; IS-1 `executiveStrategyReasoning` is stored but **never rendered** |
| 2 | Vendor Discovery | **HIGH** | UI uses 6-stage `DISCOVERY_PIPELINE_STAGE_DEFS`; IS-2 `vendorDiscoveryFunnel` (9 stages) stored but incompatible / often rebuilt |
| 3 | Vendor Recommendations | **HIGH** | UI uses `deriveVendorRankingFactors()`; IS-1 `selectedReasoning` stored but not primary render path |
| 4 | Budget Planner | **MEDIUM** | Budget amounts can follow Director rules; UI grounding uses `getBudgetAllocationReason()` industry templates, not `budgetPlannerReasoning` |
| 5 | Timeline | **CRITICAL** | UI uses `buildTimelineWeeksForCampaign()` generic phases; IS-1 `creatorActivationTimeline` stored but **not used** |
| 6 | Creator Mix | **MEDIUM** | Correct when `applyIs1ReasoningToSections` ran; **fallback** `buildCreatorMixFromFacts()` uses hardcoded industry tiers (≠ IS-3 winner 15/45/40) |
| 7 | KPI Forecast | **CRITICAL** | UI uses `buildGroundedKpisFromFacts()`; ignores winner KPIs in `strategy.understanding.kpis` and `kpiReasoning` |
| 8 | Risk Analysis | **HIGH** | UI **prefers** `enrichedRisks` from `getIndustryRisks()` over Director `operations.content.risks` |
| 9 | Thinkway Decision Rationale | **CRITICAL** | Section maps to `why-ai`; UI reads `deriveWhyAiInsights()` industry templates; `directorDecisionMinutes` stored but **resolver unused in any component** |

### Dead resolver exports

The following resolver functions are **defined but never wired to any React component**:

- `resolveDirectorDecisionMinutes` — `features/campaign-studio/services/section-data-resolver.ts`
- `resolveExecutiveStrategyReasoning` — `features/campaign-studio/services/section-data-resolver.ts`

---

## Per-Section Audit (8 Questions Each)

### 1. Executive Strategy

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | `CampaignStrategyDocument.narrative` + IS-1 `ExecutiveStrategyReasoning` (post-debate via `buildExecutiveStrategyReasoning`) |
| 2. Which file writes it? | `campaign-director.ts` → `buildApprovedSections` (`strategy` key); `studio-section-data-builders.ts` → `buildStrategySectionData` |
| 3. Which file enriches it? | `enrichCampaignObjectWithStudioData` → `deriveGroundedStrategy`; `applyIs1ReasoningToSections` → `executiveStrategyReasoning` |
| 4. Which resolver reads it? | `resolveGroundedStrategyFields` (**NOT** `resolveExecutiveStrategyReasoning`) |
| 5. Which React component renders it? | `features/campaign-studio/components/sections/executive-strategy-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Yes** — `buildStrategySectionData` always runs `deriveGroundedStrategy` from markdown text |
| 7. Is any generic fallback still used? | **Yes** — industry profile + `deriveExecutiveStrategyFields` templates in `presentation-intelligence.ts` |
| 8. Does rendered content still contain old template logic? | **Yes** — hardcoded grounding source map (`Industry`/`Client`/`AI`/`Historical`) |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Brief → Facts → Debate winner → `strategy.narrative` → enrich `groundedFields` → resolver → ExecutiveStrategySection |
| **Source** | IS-1 `ExecutiveStrategyReasoning` + debate winner narrative |
| **Legacy Bypass** | IS-1 debate-enriched reasoning bypassed at render; `resolveExecutiveStrategyReasoning` unused |
| **Risk** | **CRITICAL** — debate winner rationale invisible in primary cards |
| **Recommended Fix** | Render `executiveStrategyReasoning` (or merge into `groundedFields` at enrich time); stop deriving from text when IS-1 data present |

---

### 2. Vendor Discovery

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | IS-1 `VendorDiscoveryFunnelStage[]` via `buildVendorDiscoveryFunnel` |
| 2. Which file writes it? | `section-updaters.ts` (`search-creators` task); `campaign-director.ts` (`creators` approved section) |
| 3. Which file enriches it? | `studio-section-data-builders.ts` → `applyIs1ReasoningToSections` / `buildCreatorDiscoveryPipeline` fallback |
| 4. Which resolver reads it? | `resolveVendorDiscovery` → `resolveDiscoveryPipeline` |
| 5. Which React component renders it? | `vendor-discovery-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Yes** — `resolveDiscoveryPipeline` rebuilds 6-stage pipeline when stored funnel is "contradictory" |
| 7. Is any generic fallback still used? | **Yes** — `deriveDiscoveryPipeline(total, isSearching)` ratio fabrication |
| 8. Does rendered content still contain old template logic? | **Yes** — stage IDs `db/screened/matched/ai/ranked/recommended` ≠ IS-2 `database/country/.../approved` |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | IS-1 funnel → `creators.data.vendorDiscoveryFunnel` → enrich → `resolveDiscoveryPipeline` → VendorDiscoverySection |
| **Source** | IS-1 `VendorDiscoveryFunnelStage[]` (9 stages) |
| **Legacy Bypass** | 6-stage legacy pipeline rebuilt at resolver; IS-2 funnel schema mismatch |
| **Risk** | **HIGH** |
| **Recommended Fix** | Single funnel schema; resolver reads `vendorDiscoveryFunnel` verbatim when present |

---

### 3. Vendor Recommendations

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | `CreatorsSectionData.recommendations` + IS-1 `selectedReasoning` / `rejectedReasoning` |
| 2. Which file writes it? | `structured-section-builders.ts` → `buildCreatorRecommendationData`; `section-updaters.ts` (`build-shortlist`) |
| 3. Which file enriches it? | `applyIs1ReasoningToSections` merges `vendorRecommendations` |
| 4. Which resolver reads it? | `resolveVendorRecommendations` (text parse) + `resolveVendorGrounding` → `deriveVendorRankingFactors` |
| 5. Which React component renders it? | `vendor-recommendations-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Yes** — grounding derived unless `vendorGrounding` match with non-empty rationale |
| 7. Is any generic fallback still used? | **Yes** — industry-based factor derivation in `presentation-intelligence.ts` |
| 8. Does rendered content still contain old template logic? | **Yes** — "Why:" line from derived factors, not IS-1 selection minutes |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Shortlist task → recommendations → IS-1 reasoning → `resolveVendorGrounding` → VendorRecommendationsSection |
| **Source** | IS-1 `selectedReasoning` / `rejectedReasoning` per vendor |
| **Legacy Bypass** | `deriveVendorRankingFactors()` overrides IS-1 selection minutes |
| **Risk** | **HIGH** |
| **Recommended Fix** | Prefer `recommendations.selectedReasoning[i]` for `whySelected` when present |

---

### 4. Budget Planner

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | `BudgetSectionData` + IS-1 `BudgetPlannerReasoning` |
| 2. Which file writes it? | `section-updaters.ts` (`estimate-budget`) + `applyDirectorBudgetRules` |
| 3. Which file enriches it? | `buildBudgetSectionExtras` → `getBudgetAllocationReason` (industry-intelligence) |
| 4. Which resolver reads it? | `resolveBudgetData` |
| 5. Which React component renders it? | `budget-planner-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Partial** — amounts can follow Director; `groundedAllocations.reason` from industry templates |
| 7. Is any generic fallback still used? | **Yes** — `deriveInfluencerBudgetAllocations` when percents missing |
| 8. Does rendered content still contain old template logic? | **Yes** — CPM/CPE from `getIndustryProfile`, not debate budget slice |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Director budget rules → `budget.data` → enrich → `resolveBudgetData` → BudgetPlannerSection |
| **Source** | IS-1 `BudgetPlannerReasoning` + Director `applyDirectorBudgetRules` |
| **Legacy Bypass** | Amounts may align; reasoning from industry templates, not `budgetPlannerReasoning` |
| **Risk** | **MEDIUM** |
| **Recommended Fix** | Surface `budget.data.allocationReasoning` / `budgetPlannerReasoning` in UI badges |

---

### 5. Timeline

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | `TimelineSectionData` milestones + IS-1 `CreatorActivationTimeline` |
| 2. Which file writes it? | `section-updaters.ts` + `applyDirectorTimelineRules` |
| 3. Which file enriches it? | `buildTimelineSectionExtras` → `buildTimelineWeeksForCampaign` |
| 4. Which resolver reads it? | `resolveTimelineData` → `buildTimelineWeeksForCampaign` (ignores `creatorActivationTimeline`) |
| 5. Which React component renders it? | `timeline-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Yes** — resolver never reads `timeline.data.creatorActivationTimeline` |
| 7. Is any generic fallback still used? | **Yes** — industry week templates when milestones sparse |
| 8. Does rendered content still contain old template logic? | **Yes** — generic phase names (Kickoff, Production, Go-live patterns) |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Director timeline rules → milestones → enrich → `buildTimelineWeeksForCampaign` → TimelineSection |
| **Source** | IS-1 `CreatorActivationTimeline` + winner `activationApproach: ramp` week weights |
| **Legacy Bypass** | `creatorActivationTimeline` stored but resolver ignores it entirely |
| **Risk** | **CRITICAL** — winner ramp week weights not shown |
| **Recommended Fix** | Resolver should prefer `creatorActivationTimeline.activationWeeks` when present |

---

### 6. Creator Mix

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | `strategy.creatorTierStrategy` (post-debate) → IS-1 `CreatorMixReasoning` |
| 2. Which file writes it? | `campaign-director.ts` (`creators.data.creatorMixReasoning`); enrich sets `strategy.data.creatorMix` |
| 3. Which file enriches it? | `buildCreatorMixFromReasoningTiers` (correct) vs `buildCreatorMixFromFacts` (hardcoded 35/40/25 baby, etc.) |
| 4. Which resolver reads it? | `resolveCreatorMix` — prefers `strategy.data.creatorMix`, else facts fallback |
| 5. Which React component renders it? | `creator-mix-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Yes** — `buildStrategySectionData` sets facts-default mix before IS-1 overwrite (order-dependent) |
| 7. Is any generic fallback still used? | **Yes** — `buildCreatorMixFromFacts` ≠ winner Macro 15 / Micro 45 / Nano 40 |
| 8. Does rendered content still contain old template logic? | **Yes** — `MIX_BY_INDUSTRY` in `deriveCreatorMix` when no tier strategy |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Debate winner tiers → IS-1 reasoning → enrich → `resolveCreatorMix` → CreatorMixSection |
| **Source** | IS-3 winner `creatorTierStrategy` (Macro 15% · Micro 45% · Nano 40%) |
| **Legacy Bypass** | `buildCreatorMixFromFacts()` hardcoded industry tiers when director enrich path skipped |
| **Risk** | **MEDIUM** (HIGH on ERS-3 path without director sync) |
| **Recommended Fix** | Resolver should read `strategyDocument.creatorTierStrategy` via facts bridge; never industry defaults when debate metadata exists |

---

### 7. KPI Forecast

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | Winner option KPIs in `strategy.understanding.kpis` + IS-1 `kpiReasoning` |
| 2. Which file writes it? | `section-updaters.ts` (`build-strategy` task) — facts KPIs preferred over strategy |
| 3. Which file enriches it? | `buildPerformanceSectionData` → `buildGroundedKpisFromFacts` |
| 4. Which resolver reads it? | `resolveGroundedKpis` — **facts first**, ignores `buildGroundedKpisFromStrategy` |
| 5. Which React component renders it? | `kpi-forecast-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Yes** — `CampaignFacts.kpis` overrides debate KPIs |
| 7. Is any generic fallback still used? | **Yes** — `getGroundedKpis(industry, combined)` when no facts KPIs |
| 8. Does rendered content still contain old template logic? | **Yes** — generic industry benchmark KPI sets |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Debate winner KPIs → strategy understanding → enrich → `resolveGroundedKpis` → KpiForecastSection |
| **Source** | Winner option KPIs + IS-1 `kpiReasoning` |
| **Legacy Bypass** | `CampaignFacts.kpis` and facts-first resolver ignore debate KPIs |
| **Risk** | **CRITICAL** |
| **Recommended Fix** | After debate, use `buildGroundedKpisFromStrategy(challengeResult.strategy)` as SSOT |

---

### 8. Risk Analysis

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | Winner `strategy.understanding.risks` + specialist risk output |
| 2. Which file writes it? | `section-updaters.ts` → `buildRiskAnalysisFromBudget`; `campaign-director.ts` operations section |
| 3. Which file enriches it? | `buildOperationsSectionExtras` → `getIndustryRisks(industry)` |
| 4. Which resolver reads it? | `resolveRiskData` |
| 5. Which React component renders it? | `risk-analysis-section.tsx` |
| 6. Is any legacy parser still overwriting it? | **Yes** — component prefers `enrichedRisks` over `content.risks` |
| 7. Is any generic fallback still used? | **Yes** — `buildRiskAnalysisFromBudget` when no structured risks |
| 8. Does rendered content still contain old template logic? | **Yes** — static industry risk catalog |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Director operations risks → enrich → `resolveRiskData` → RiskAnalysisSection |
| **Source** | Winner `strategy.understanding.risks` + specialist output |
| **Legacy Bypass** | `enrichedRisks` from `getIndustryRisks()` takes precedence over Director risks |
| **Risk** | **HIGH** |
| **Recommended Fix** | Render Director/strategy risks first; treat `enrichedRisks` as supplemental only |

---

### 9. Thinkway Decision Rationale / Director Decision Minutes

| Q | Answer |
|---|--------|
| 1. Which pipeline object generated this section? | IS-1 `DirectorDecisionMinute[]` + debate summary in `buildDirectorDecisionMinutes` |
| 2. Which file writes it? | `campaign-director.ts` → `strategy.data.directorDecisionMinutes`; enrich via `applyIs1ReasoningToSections` |
| 3. Which file enriches it? | Same; **also** overwrites `whyAiInsights` via `deriveWhyAiInsights` |
| 4. Which resolver reads it? | **`resolveWhyAi`** (wrong field) — `resolveDirectorDecisionMinutes` exists but unused |
| 5. Which React component renders it? | `why-ai-section.tsx` (label: "Thinkway Decision Rationale" in layout) |
| 6. Is any legacy parser still overwriting it? | **Yes** — `deriveWhyAiInsights` replaces decision minutes at display layer |
| 7. Is any generic fallback still used? | **Yes** — 4-card industry template (Creators/Budget/Strategy/KPIs) |
| 8. Does rendered content still contain old template logic? | **Yes** — e.g. "124 baby campaigns · mom creator trust score 4.6/5" |

| Field | Detail |
|-------|--------|
| **Pipeline Path** | Debate summary → IS-1 minutes → enrich → `resolveWhyAi` (not `resolveDirectorDecisionMinutes`) → WhyAiSection |
| **Source** | IS-1 `DirectorDecisionMinute[]` + IS-3 debate summary |
| **Legacy Bypass** | `deriveWhyAiInsights()` industry templates replace stored decision minutes |
| **Risk** | **CRITICAL** — entire IS-1/IS-3 decision narrative disconnected from UI |
| **Recommended Fix** | Wire `why-ai-section.tsx` to `resolveDirectorDecisionMinutes`; map minute fields to card layout |

---

## Validation Comparison (Simulated — No Script Execution)

**Sources used (existing artifacts, no code changes):**

- IS-3 debate: `docs/intelligence/is3-debate-engine-validation-results.json` — all 5 fixtures, winner **Option C** (Macro 15% · Micro 45% · Nano 40%)
- ERS-3 workflow mock: `features/campaign-intelligence/validate-ers3-campaign-object-integrity.ts` — **does not inject director pipeline or campaignFacts**
- IS-1 bundle: `docs/intelligence/is1-intelligence-validation-results.json` — BabyJoy `chosenStrategy` shows Macro 29% · Micro 42% (pre-IS-3 alignment gap)

### Winning Strategy vs Resolver Output — Mismatch Matrix

| Fixture | Executive | Discovery | Vendors | Budget | Timeline | Creator Mix | KPI | Risk | Decision Rationale |
|---------|-----------|-----------|---------|--------|----------|-------------|-----|------|-------------------|
| BabyJoy | FAIL | FAIL | FAIL | FAIL* | FAIL | FAIL** | FAIL | FAIL | FAIL |
| Coca-Cola | FAIL | FAIL | FAIL | FAIL* | FAIL | FAIL** | FAIL | FAIL | FAIL |
| Tourism | FAIL | FAIL | FAIL | FAIL* | FAIL | FAIL** | FAIL | FAIL | FAIL |
| Samsung | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL** | FAIL | FAIL | FAIL |
| L'Oréal | FAIL | FAIL | FAIL | FAIL* | FAIL | FAIL** | FAIL | FAIL | FAIL |

\* Budget **amounts** may align when Director rules run; **reasoning** still industry-template → counted FAIL for end-to-end fidelity  
\** Creator Mix **PASS** only when full director enrich path populates `strategy.data.creatorMix` from IS-1 tiers matching winner; ERS-3 / facts-only path → FAIL (hardcoded 35/40/25 or industry mix)

### Additional Fixture-Specific FAIL Notes

| Fixture | Notable mismatch |
|---------|------------------|
| BabyJoy | IS-3 facts duration **4w** vs brief **6 weeks**; IS-1 chosenStrategy tiers ≠ winner 15/45/40 |
| Coca-Cola | IS-3 facts duration **6w** vs brief **8 weeks** (per IS3 timeline root-cause docs) |
| Tourism | Same tier/resolver disconnect; ERS-3 populates via legacy derive (false "PASS") |
| Samsung | Same pattern as Coca-Cola (CPG/retail industry routing) |
| L'Oréal | Same pattern; beauty industry `getIndustryRisks` overrides debate risks |

### FAIL Count Breakdown

| Category | Count |
|----------|-------|
| Section × fixture mismatches (7 always-fail sections × 5 fixtures) | **35** |
| Creator Mix fallback mismatches (5 fixtures) | **5** |
| Budget reasoning mismatches (5 fixtures) | **2** (counted separately only where amounts OK but reasoning wrong — total unique cells still **42**) |

**Total documented FAIL mismatches: 42** (conservative end-to-end fidelity count; **0 PASS** claims)

### ERS-3 False Positive Warning

All 5 ERS-3 scenarios report `passed: true` and all studio sections populated (`docs/validation-artifacts/ers-3/validation-report.json`) **without** director pipeline or debate winner — validates legacy derive path only. This must not be interpreted as end-to-end intelligence fidelity.

---

## Recommended Fix Priority (Documentation Only)

| Priority | Scope | Actions |
|----------|-------|---------|
| **P0** | Wire IS-1 data to resolvers | Executive Strategy, Decision Rationale, Timeline, KPI — connect stored reasoning objects to render path; activate dead resolvers |
| **P1** | Stop industry override | Risk (`enrichedRisks` precedence), Vendor Discovery funnel schema unification |
| **P2** | ERS-3 validation gap | Inject `runCampaignDirectorPipeline` + `applyDirectorPipelineToCampaignObject` + assert winner fields match resolver output |
| **P3** | Re-enrich after director sync | `syncFromWorkflowState` applies director sections after enrich without second enrich pass |

---

## Manual Review Required

| Check | Status |
|-------|--------|
| All 9 sections traced Brief → Studio | Documented |
| Legacy bypass risks identified | 4 CRITICAL, 3 HIGH, 2 MEDIUM |
| Dead resolvers identified | `resolveDirectorDecisionMinutes`, `resolveExecutiveStrategyReasoning` |
| Fixture comparison (5 brands) | 42 FAIL mismatches |
| Automated PASS claim | **Not issued** |
| Human sign-off | **Required** |

---

## Related Artifacts

| File | Purpose |
|------|---------|
| `docs/intelligence/END_TO_END_AUDIT_RAW.json` | Structured machine-readable findings |
| `docs/intelligence/is3-debate-engine-validation-results.json` | IS-3 debate winner per fixture |
| `docs/intelligence/is1-intelligence-validation-results.json` | IS-1 reasoning bundle |
| `docs/validation-artifacts/ers-3/validation-report.json` | ERS-3 population checks (legacy path) |
| `features/campaign-studio/services/section-data-resolver.ts` | Resolver definitions including dead exports |

---

*End of Release 1.1.4 Intelligence End-to-End Pipeline Audit*
