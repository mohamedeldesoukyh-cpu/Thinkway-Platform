# UX-1 Placeholder-After-Complete Root Cause

## Symptom
Section badge showed **Complete** while the card body still rendered pending placeholders:
- Budget: "Budget allocation pending…"
- Timeline: "Timeline pending…"
- Risk: "Risk analysis pending…"
- Presentation: "Presentation status pending…"
- Vendor Recommendations: "Run discovery to generate recommendations"

## Root Causes

### 1. Resolver / data shape mismatch
`section-data-resolver.ts` only accepted typed objects on `sections.*.content` (e.g. `isBudgetSectionData`). Completed workflows often store **markdown strings** on `.content` and structured extras on `.data` (`weekDetails`, `groundedAllocations`, `enrichedRisks`). Resolvers returned `null` → renderers showed placeholders even when section status was `complete`.

### 2. Missing render-time enrichment
`enrichCampaignObjectWithStudioData()` populated `.data` fields but was only called during persistence updates — not when hydrating Campaign Studio for display. UI read stale/un-enriched objects.

### 3. Renderers ignored section status
Section components showed `"…pending…"` whenever structured data was missing, without checking `status === "complete"`. They should fall back to `section.content` text instead of pending copy when complete.

### 4. Vendor recommendations stub
`resolveVendorRecommendations()` was a no-op returning `[]`, so recommendations always hit the discovery empty-state even when `recommendationsDisplay` existed.

## Fix Applied
1. **Resolvers** — parse string content, read `.data` extras, synthesize structured payloads (budget, timeline, risk, presentation).
2. **Render-time enrichment** — call `enrichCampaignObjectWithStudioData()` in `use-campaign-studio.ts` before building studio state.
3. **Status-aware renderers** — shared `shouldShowPendingPlaceholder()` + `SectionFallbackContent` in all section components; placeholders only when `pending`/`running`.
4. **Vendor recommendations** — parse `recommendationsDisplay` and respect complete-status fallback text.

## Files Changed
- `features/campaign-studio/services/section-data-resolver.ts`
- `features/campaign-studio/hooks/use-campaign-studio.ts`
- `features/campaign-studio/components/sections/shared/section-status-utils.tsx` (new)
- All section renderers under `features/campaign-studio/components/sections/`
