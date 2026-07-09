# Campaign Facts Migration Table

**Date:** 2026-07-04  
**Purpose:** Track migration of nine factual fields from legacy display parsers to `CampaignObject.meta.campaignFacts` SSOT  
**Total bypass locations:** 91 across 9 fields

---

## Summary by Status

| Migration status | Field count | Fields |
|------------------|-------------|--------|
| PARTIAL | 4 | Budget, Currency, Duration, Campaign Objective |
| BYPASS | 5 | Brand, Client, Creator Mix, Timeline, KPIs |
| COMPLIANT (display) | 0 | — |

Generation path compliance (~40%) does not satisfy display requirements. No field reaches display COMPLIANT status.

---

## Per-Field Migration Table

| Field | Current source (display) | Target source | Migration status | Files still using legacy logic |
|-------|-------------------------|---------------|------------------|-------------------------------|
| **Budget** | `buildBudgetSectionData` ← LLM `estimate-budget` text + `state.data.budgetTotal` (post-`continuation.ts` overwrite) | `meta.campaignFacts.budget` → structured `sections.budget.content` | PARTIAL | `features/ai-workflows/engine/continuation.ts`, `features/campaign-intelligence/services/structured-section-builders.ts`, `features/campaign-intelligence/services/section-updaters.ts`, `features/campaign-director/integrations/section-builder-integration.ts`, `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/section-data-resolver.ts`, `features/campaign-studio/services/industry-intelligence.ts`, `features/campaign-decision-engine/campaign-context.ts`, `features/campaign-studio/components/sections/budget-planner-section.tsx` |
| **Currency** | `detectCurrencyFromText` / `resolveCampaignObjectCurrency` on section text cascade | `meta.campaignFacts.budget.currency` | PARTIAL | `features/ai-workflows/engine/continuation.ts`, `features/campaign-intelligence/services/structured-section-builders.ts`, `features/campaign-studio/components/sections/shared/format-utils.ts`, `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/section-data-resolver.ts`, `features/campaign-studio/services/industry-intelligence.ts` |
| **Duration** | `resolveCampaignDurationWeeks(summaryText, strategyText)` + `parseDurationWeeks` | `meta.campaignFacts.durationWeeks` | PARTIAL | `features/campaign-intelligence/services/structured-section-builders.ts`, `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/timeline-duration.ts`, `features/campaign-studio/services/presentation-intelligence.ts`, `features/campaign-studio/services/industry-intelligence.ts`, `features/campaign-studio/services/section-data-resolver.ts`, `features/campaign-studio/components/sections/timeline-section.tsx`, `features/campaign-intelligence/services/section-updaters.ts` |
| **Brand** | `buildSummarySectionData` → `parseBrandFromText` / LLM field patterns | `meta.campaignFacts.brandName` | BYPASS | `features/ai-workflows/engine/continuation.ts`, `features/ai-workflows/definitions/create-campaign.ts`, `features/campaign-studio/components/sections/shared/format-utils.ts`, `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/section-data-resolver.ts`, `features/campaign-studio/services/presentation-intelligence.ts`, `features/campaign-studio/components/sections/campaign-summary-section.tsx`, `features/campaign-studio/components/sections/presentation-status-section.tsx` |
| **Client** | `resolveClientFromBrief(combined)` hardcoded brand list | `meta.campaignFacts.clientName` | BYPASS | `features/campaign-studio/services/industry-intelligence.ts`, `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/presentation-intelligence.ts`, `features/campaign-studio/components/sections/campaign-summary-section.tsx` |
| **Campaign Objective** | `parseObjectiveFromText` + `deriveExecutiveStrategyFields` extractSection | `meta.campaignFacts.objective` | PARTIAL | `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/presentation-intelligence.ts`, `features/campaign-intelligence/services/section-updaters.ts`, `features/campaign-studio/components/sections/executive-strategy-section.tsx`, `features/campaign-studio/components/sections/campaign-summary-section.tsx`, `features/campaign-studio/components/sections/shared/format-utils.ts` |
| **Creator Mix** | `deriveCreatorMix` → `MIX_BY_INDUSTRY` | `strategy.creatorTierStrategy` (from facts industry) | BYPASS | `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/presentation-intelligence.ts`, `features/campaign-studio/services/section-data-resolver.ts`, `features/campaign-studio/components/sections/creator-mix-section.tsx` |
| **Timeline** | `buildTimelineSectionData` (LLM) + `buildTimelineWeeksForCampaign` (templates) | `buildClientTimelineFromStrategy` from facts duration | BYPASS | `features/campaign-intelligence/services/structured-section-builders.ts`, `features/campaign-intelligence/services/section-updaters.ts`, `features/campaign-director/integrations/section-builder-integration.ts`, `features/campaign-studio/services/presentation-intelligence.ts`, `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/section-data-resolver.ts`, `features/campaign-studio/components/sections/timeline-section.tsx`, `features/campaign-decision-engine/campaign-context.ts` |
| **KPIs** | `getGroundedKpis` industry templates | `meta.campaignFacts.kpis` → `strategy.understanding.kpis` | BYPASS | `features/campaign-intelligence/services/structured-section-builders.ts`, `features/campaign-intelligence/services/section-updaters.ts`, `features/campaign-studio/services/industry-intelligence.ts`, `features/campaign-intelligence/services/studio-section-data-builders.ts`, `features/campaign-studio/services/section-data-resolver.ts`, `features/campaign-studio/components/sections/kpi-forecast-section.tsx`, `features/campaign-decision-engine/campaign-context.ts` |

---

## Generation vs Display Compliance

| Field | Generation path (Director) | Display path (Studio) |
|-------|---------------------------|----------------------|
| Budget | PARTIAL — `buildDirectorBudgetFromStrategy` reads facts; `applyDirectorBudgetRules` omits facts | BYPASS — resolvers re-parse LLM |
| Currency | PARTIAL — workflow init seeds from facts; overwritten by continuation | BYPASS — text cascade |
| Duration | PARTIAL — strategy + timeline rules | BYPASS — LLM defaults + resolver |
| Brand | PARTIAL — facts → strategy | BYPASS — hardcoded regex |
| Client | PARTIAL — facts → strategy | BYPASS — hardcoded regex |
| Campaign Objective | PARTIAL — facts → strategy | BYPASS — LLM extractSection |
| Creator Mix | PARTIAL — strategy tiers from facts industry | BYPASS — MIX_BY_INDUSTRY |
| Timeline | PARTIAL — director rules when strategy in state | BYPASS — LLM + templates |
| KPIs | PARTIAL — facts → strategy KPIs | BYPASS — getGroundedKpis templates |

**Overall:** Generation ~40% facts-compliant · Display ~0% facts-compliant

---

## Cross-Cutting Files Requiring Migration (All Fields)

These files affect multiple audited fields and must adopt facts-first precedence before per-field fixes are durable.

| File | Role | Fields affected |
|------|------|-----------------|
| `features/campaign-intelligence/services/studio-section-data-builders.ts` | Central display enrichment via `enrichCampaignObjectWithStudioData` — must read `meta.campaignFacts` first | All 9 |
| `features/campaign-studio/services/section-data-resolver.ts` | All resolver exports (`resolveBudgetData`, `resolveCampaignSummary`, `resolveTimelineData`, `resolveGroundedKpis`, etc.) | All 9 |
| `features/campaign-intelligence/services/section-updaters.ts` | Task→section mapping; binds LLM text to sections | Budget, Currency, Duration, Objective, Timeline, KPIs |
| `features/campaign-intelligence/services/structured-section-builders.ts` | Legacy LLM parsers (`buildBudgetSectionData`, `buildTimelineSectionData`, `buildKpiForecastFromStrategy`) | Budget, Currency, Duration, Timeline, KPIs |
| `features/ai-workflows/engine/continuation.ts` | Overwrites facts-derived workflow state from LLM task output | Budget, Currency, Brand |
| `features/campaign-director/integrations/section-builder-integration.ts` | Director rule application — must pass `campaignFacts` to budget rules | Budget |
| `features/campaign-studio/services/presentation-intelligence.ts` | Industry templates for creator mix, timeline weeks, executive fields | Brand, Client, Objective, Creator Mix, Timeline |
| `features/campaign-studio/services/industry-intelligence.ts` | Hardcoded brand list in `resolveClientFromBrief`; `getGroundedKpis` templates | Brand, Client, Budget, Duration, KPIs |
| `features/campaign-studio/components/sections/shared/format-utils.ts` | `parseBrandFromText` hardcoded list; currency/duration parsers | Brand, Currency, Duration, Objective |
| `features/campaign-studio/hooks/use-campaign-studio.ts` | Enrichment entry point (L174) | All 9 |
| `features/campaign-decision-engine/campaign-context.ts` | Decision simulation reads bypass resolver chain | Budget, Timeline, KPIs |
| `features/campaign-decision-workspace/services/promote-scenario.ts` | Re-enriches via bypass path after scenario promotion (L120) | All 9 |

---

## Director Integration (Generation — Partial Compliance)

These files **do** read `CampaignFacts` but output is bypassed before browser display.

| File | Reads facts? | Display binding? |
|------|-------------|------------------|
| `features/campaign-director/facts/extract-campaign-facts.ts` | Origin SSOT | N/A |
| `features/campaign-director/facts/validate-campaign-facts.ts` | Yes | N/A |
| `features/campaign-director/services/strategy-document.ts` | Yes | Stored in strategy, not read by resolvers |
| `features/campaign-director/services/budget-rules.ts` | Yes | Bypassed by `buildBudgetSectionData` |
| `features/campaign-director/services/timeline-rules.ts` | Via strategy | Bypassed when LLM timeline exists |
| `features/campaign-director/services/specialist-dispatch.ts` | Via strategy | Bypassed by presentation-intelligence |
| `features/campaign-director/integrations/workflow-integration.ts` | Writes `meta.campaignFacts` | Write-only for display |
| `features/ai-workflows/engine/workflow-engine.ts` | Seeds state from facts | State overwritten by continuation |

---

## React Section Components (Display Consumers)

All section components consume resolver output — none read `meta.campaignFacts` directly.

| Component | Resolver / builder | Primary fields |
|-----------|-------------------|----------------|
| `campaign-summary-section.tsx` | `resolveCampaignSummary` | Brand, Client, Budget, Duration, Objective |
| `budget-planner-section.tsx` | `resolveBudgetData` | Budget, Currency |
| `timeline-section.tsx` | `resolveTimelineData` | Duration, Timeline |
| `kpi-forecast-section.tsx` | `resolveGroundedKpis` | KPIs |
| `creator-mix-section.tsx` | `resolveCreatorMix` | Creator Mix |
| `executive-strategy-section.tsx` | `resolveGroundedStrategyFields` | Campaign Objective |
| `presentation-status-section.tsx` | `resolvePresentationData` | Brand |

---

## Migration Priority (Recommended Order)

1. **Facts-first resolver layer** — `section-data-resolver.ts` + `enrichCampaignObjectWithStudioData` read `meta.campaignFacts` before any text parser
2. **Stop state overwrite** — `continuation.ts` must not replace facts-derived budget/currency/brand
3. **Remove hardcoded brand lists** — `parseBrandFromText`, `resolveClientFromBrief`
4. **Bind KPI display to strategy** — replace `getGroundedKpis` with `facts.kpis` / `strategy.understanding.kpis`
5. **Director budget integration** — pass `campaignFacts` to `applyDirectorBudgetRules`
6. **Timeline facts binding** — prefer `buildClientTimelineFromStrategy` over LLM defaults

---

## Related Documents

- `docs/intelligence/CAMPAIGN_FACTS_DEPENDENCY_AUDIT.md` — full per-field traces and QA root causes
- `docs/intelligence/CAMPAIGN_FACTS_AUDIT_RAW.json` — machine-readable findings
- `docs/intelligence/CAMPAIGN_FACTS_LAYER.md` — intended architecture
