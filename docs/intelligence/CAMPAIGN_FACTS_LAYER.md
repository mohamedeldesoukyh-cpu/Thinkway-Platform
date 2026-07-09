# Campaign Facts Layer

Structured factual SSOT for the Campaign Director intelligence pipeline. Raw user prompts may provide context, but **budget, duration, currency, client, brand, geography, platforms, KPIs, and campaign type** must come from validated `CampaignFacts` — never re-parsed independently by specialists.

## Architecture

```
Campaign Brief (raw)
  ↓
extractCampaignFacts() — deterministic regex + existing parsers
  ↓
validateCampaignFacts() — normalize currency, clamp duration 1–52, positive budget
  ↓
CampaignFacts (SSOT)
  ↓
writeStrategyDocumentFromBrief(facts) — strategy references factsRef
  ↓
buildDirectorTaskPrompt(strategy, domain, task, facts)
  ↓
Specialists + section builders consume facts via formatCampaignFactsForSpecialist()
```

## Module location

`features/campaign-director/facts/`

| File | Purpose |
|------|---------|
| `campaign-facts-types.ts` | `CampaignFacts` interface |
| `extract-campaign-facts.ts` | Deterministic extraction from brief |
| `validate-campaign-facts.ts` | Normalize / clamp / validate |
| `facts-to-context.ts` | JSON block for Director + specialists |

## Schema (`CampaignFacts`)

```typescript
{
  clientName?: string
  brandName?: string
  industry?: string
  campaignType?: string
  objective?: string
  budget?: { amount: number; currency: string }
  durationWeeks?: number
  geography?: string[]
  audience?: string
  platforms?: string[]
  kpis?: string[]
  constraints?: string[]
  risks?: string[]
  rawBriefExcerpt?: string  // context only — not authoritative
  extractedAt: string
  confidence: Record<string, number>
  sources: Record<string, 'brief' | 'inferred' | 'default'>
}
```

## Extraction approach

Reuses existing deterministic parsers (no LLM):

- **Budget / currency:** `parseBudgetTotalFromText`, `detectCurrencyFromSources` (`format-utils`)
- **Duration:** `parseDurationFromText`, `parseDurationWeeks` (clamped 1–52)
- **Brand / client:** `parseBrandFromText`, `resolveClientFromBrief`, workflow `brandName` override
- **Industry / campaign type:** `detectIndustryFromBrief`, `getIndustryProfile`
- **Audience / geography:** `parseAudienceFromText`, `parseMarketFromText`, `in` / `across` patterns
- **Platforms:** explicit channel mentions, else industry defaults
- **KPIs / constraints / risks:** labeled patterns + category heuristics

Each populated field records `confidence` (0–1) and `sources` (`brief` | `inferred` | `default`).

## Integration points

| Location | Change |
|----------|--------|
| `workflow-engine.ts` | `initializeDirectorPipelineState` → `state.data.campaignFacts` |
| `create-campaign.ts` | `buildDirectorTaskPrompt(..., campaignFacts)`; budget task reads facts currency/amount |
| `campaign-director.ts` | Pipeline extracts facts before strategy; `getCampaignFactsFromWorkflowData()` |
| `strategy-document.ts` | Builds strategy from facts only (no independent re-parse) |
| `specialist-dispatch.ts` | Finance + presentation use facts for brand/budget |
| `budget-rules.ts` | `buildDirectorBudgetFromStrategy(..., campaignFacts)` |
| `workflow-integration.ts` | Persists `meta.campaignFacts` on CampaignObject |

## Conflict prevention rules

| Section | Rule |
|---------|------|
| Budget | `facts.budget.amount` + `facts.budget.currency` — never guess from prompt |
| Timeline | `facts.durationWeeks` |
| Presentation | `facts.brandName` / `facts.clientName` |
| Budget categories | `facts.campaignType` / industry drives influencer allocation weights |
| Strategy narrative | Includes `factsRef.extractedAt` + field list for traceability |

## Before / after error prevention

| Error | Before | After |
|-------|--------|-------|
| Wrong currency | LLM reads "$" in prose while brief says EGP | Facts SSOT: `EGP 2,000,000` propagated to strategy, budget, summary |
| Wrong duration | Timeline task invents 10 weeks when brief says 6 | `durationWeeks: 6` clamped and used by timeline section |
| Wrong brand in presentation | Specialist re-parses "Premium Diapers" as brand | `brandName: BabyJoy` from facts |
| Budget section USD vs EGP mismatch | Budget builder re-detects currency from narrative | `buildDirectorBudgetFromStrategy` reads `campaignFacts.budget.currency` |

## Validation

```bash
node scripts/validate-campaign-facts.mjs
node scripts/validate-campaign-director.mjs
npm run build
npx tsc --noEmit
```

Fixtures: BabyJoy, Coca-Cola, Pepsi, Visit Egypt tourism briefs.

Results: `docs/intelligence/campaign-facts-validation-results.json`
