# Campaign Match → Shared Relevance Pipeline (Recommendation)

## Context

Discovery Search zero-results recommendations and AI campaign search already rank creators via `lib/discovery/campaign-relevance-scoring.ts` (`scoreCreatorCampaignRelevance`, `rankCreatorsByCampaignRelevance`, `describeMatchedCampaignCriteria`).

Campaign Match (`CampaignCreatorMatch` in `lib/domains/creator/types.ts`) currently uses a separate scoring surface (`match_score`, `niche_fit`, `engagement_quality`, etc.) produced outside this module.

## Recommendation

When Campaign Match is next touched, migrate ranking to the shared pipeline:

1. **Normalize inputs** — Map campaign brief / match context into `CampaignSearchCriterion[]` (same shape as AI Discovery chips). Reuse `discoveryMappedFiltersToCriteria` or a Campaign Match–specific mapper; do not duplicate criterion evaluation logic.

2. **Score with one engine** — Call `rankCreatorsByCampaignRelevance(creators, criteria, { minScore })` for ordering. Use `describeMatchedCampaignCriteria` for UI rationale chips instead of bespoke match copy.

3. **Preserve Campaign Match UX** — Keep Campaign Match routes, selection flows, and API contracts unchanged initially; only replace the internal scorer and explanation builder.

4. **Similarity as secondary signal** — Where Campaign Match needs “creators like this one,” call `findSimilarCreators` (`lib/creators/similar-creators.ts`) to expand the candidate pool, then re-rank the merged pool with campaign relevance (same dual-pool pattern as AI Discovery’s strict + relaxed browse, without progressive A→E widening).

5. **Do not merge products** — Discovery remains strict catalog browse; Campaign Match remains its own workspace. Share scoring utilities only.

## Migration checklist

- [ ] Audit Campaign Match entry points and document current score field sources
- [ ] Add `campaignMatchContextToCriteria()` adapter (brief + optional seed creator)
- [ ] Swap ranker to `rankCreatorsByCampaignRelevance`
- [ ] Map `campaign_relevance_score` → existing `match_score` at API boundary for backward compatibility
- [ ] Replace custom rationale strings with `describeMatchedCampaignCriteria`
- [ ] Add regression tests against golden Campaign Match fixtures

## Out of scope (this phase)

- No changes to Campaign Match UI or APIs
- No merging Discovery / Studio / Campaign Match navigation
- No new ranking engine or duplicate criterion evaluators
