# Thinkway 3.0 — Increment 01: Fit-first creator ranking

**Status:** Implemented · **Scope:** Discovery AI search + Studio creator recommendations ranking layer
**Systems untouched:** Creator DNA, Enterprise Discovery gates/queues, enrichment, shortlists, quotations, publications, commercial engine, campaigns, schema.

## Defects (reproduced before fixing — `repro-fit-bias.investigation.ts`)

**D1 — Unknown data counted as a proven mismatch.** Every criterion matcher in
`lib/discovery/campaign-relevance-scoring.ts` returned a boolean; absent data returned
`false` (missing demographics failed gender/age, empty `language_codes` failed language,
null metrics failed follower/engagement minimums). Worse, brand-fit fell back to
`brand_fit_score ?? thinkway_score`, leaking the data-quality score into fit.

Pre-fix output (KSA luxury-beauty brief, 8 weighted criteria):

```
Sparse Perfect Fit (KSA skincare):     score=56  matched=4/8
Enriched Off-Brief (lifestyle/travel): score=69  matched=6/8
Ranked order: Enriched Off-Brief [69] > Sparse Perfect Fit [56]
```

**D2 — Candidate pool selected by data-quality.** AI search fetched exactly one page of
200 (`AI_CAMPAIGN_PAGE_SIZE`) via `filtersToRelaxedBrowseParams` (platform-only SQL
filter); the server orders that pool by `thinkway_score DESC` and AI mode never
paginates. In a 221-creator simulation the best-fit creator (#221 by thinkway_score)
never reached the ranker at all.

## Fix

**F1 — Tri-state criterion evaluation** (`campaign-relevance-scoring.ts`):
- Matchers return `match | no_match | unknown`; `unknown` only when the underlying
  field group has no data (no geo signal, no content signal, no platforms, no language
  codes, null metrics, null scores, missing demographics). Data present but not
  matching remains a genuine `no_match`.
- `score = matchedWeight / (knownWeight + 0.5 × unknownWeight)` — unknowns discount at
  half a mismatch (`UNKNOWN_CRITERION_WEIGHT_DISCOUNT`); an all-unknown creator scores
  0, never 100.
- Brand-fit no longer falls back to `thinkway_score` (null → unknown).
- Breakdown extended (additive): `knownWeight`, `unknownWeight`, `unknownCount` —
  enables "unverified" evidence chips in a later increment. Exported signatures
  unchanged; consumers (Discovery AI search, `search-creators-from-profile` → Studio
  recommendations) inherit the behavior with no code change.

**F2 — Dual-pool candidate fetch** (AI mode only):
- New pure helper `lib/discovery/ai-candidate-pool.ts` — `mergeAiCandidatePools(strict,
  relaxed, limit=400)` dedupes by `unified_id`, strict first.
- `creator-search-workspace.tsx` AI branch fetches strict (real brief filters) and
  relaxed pools in parallel (`Promise.allSettled`; either pool alone suffices on
  failure), merges, ranks the union. Both fetches keep `skipCoverageBackfill: true`
  (unchanged AI-mode semantics — no double acquisition triggers). Non-AI browse path
  is byte-identical in behavior.

Post-fix output:

```
Sparse Perfect Fit [72] > Enriched Off-Brief [69]        (D1 inverted correctly)
LEGACY single pool — best-fit creator visible: false
FIXED  dual  pool — best-fit creator visible: true       (ranked #1)
```

## Validation

- `campaign-relevance-scoring.test.ts`: 6/6 (3 pre-existing preserved + 3 new: the D1
  inversion, no thinkway fallback for brand fit, all-unknown scores 0).
- `ai-candidate-pool.test.ts` (new): 3/3 including the D2 rescue scenario.
- All 17 `lib/discovery/*.test.ts` suites exit 0; `rank-browse-for-campaign` 2/2;
  `studio-recommendations-eval` 3/3.
- `tsc --noEmit` clean; ESLint adds zero new findings on touched files (11 pre-existing
  react-hooks findings in the workspace file at unrelated lines; baseline was 12).

**Manual E2E scenario (staging):** open Discovery → Search in AI campaign mode with a
saved Campaign Intelligence profile (category + country + niche criteria). Expect:
(1) creators matching brief filters appear even with low Thinkway scores /
"pending enrichment" status; (2) relevance percentages shift vs. previous release —
sparse on-brief creators up, enriched off-brief creators down; (3) non-AI browse
ordering unchanged.

## Intended behavior change

Relevance scores shift for all AI campaign searches; sparse-but-on-brief creators
surface (some previously cut by `minScore: 30` now qualify). This is the point of the
increment: fit beats database completeness.
