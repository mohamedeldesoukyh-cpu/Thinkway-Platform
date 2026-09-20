# Discovery 2.0 Phase 1 implementation

Status: local implementation; not committed, deployed, or applied to Production. Phase 2 is not included. The final closure corrections and migration review are documented in DISCOVERY_PHASE1_CLOSURE_REVIEW.md; they supersede the initial text/niche-only formula and raw filter-only scan limitation.

## A. Architecture

Normal Discovery now uses one authenticated server action and pure execution contract:

request -> existing lexical retrieval or selective filter-only SQL windows -> hard eligibility -> bounded qualified pool -> contextual relevance and deterministic pool sort -> page + continuation/count metadata.

The SQL RPC returns candidate windows. The server seals and sorts a qualified pool without exhausting the catalog. Later page requests replay fixed pool boundaries rather than sorting an expanding prefix. Normal UI preserves server order. Legacy explicit acquisition workflows remain separate. See DISCOVERY_PHASE1_BOUNDED_EXECUTION.md for the superseding execution rule and measured continuation limitation.

## B. Files

New:
- features/discovery/normal-search-action.ts
- lib/discovery/normal-search.ts
- lib/discovery/normal-search-transport.ts
- lib/discovery/normal-search.test.ts
- lib/discovery/normal-search-sql.test.ts
- features/discovery/components/creator-search/creator-search-timing.ts
- features/discovery/components/creator-search/creator-search-timing.test.ts
- supabase/migrations/20260920100000_discovery_normal_candidate_window.sql
- docs/DISCOVERY_PHASE1_IMPLEMENTATION.md
- docs/DISCOVERY_PHASE1_CLOSURE_REVIEW.md
- supabase/rollbacks/20260920100000_discovery_normal_candidate_window.sql

Modified:
- features/discovery/components/creator-search/creator-search-filter-fields.tsx
- features/discovery/components/creator-search/creator-search-inline-field.tsx
- features/discovery/components/creator-search/creator-search-intent-engine.test.ts
- features/discovery/components/creator-search/creator-search-result-list.tsx
- features/discovery/components/creator-search/creator-search-suite-row.tsx
- features/discovery/components/creator-search/creator-search-top-bar.tsx
- features/discovery/components/creator-search/creator-search-workspace.tsx
- lib/creators/discovery-browse-filters.ts
- lib/creators/discovery-browse-filters.test.ts
- lib/discovery/campaign-relevance-scoring.ts
- lib/discovery/campaign-relevance-scoring.test.ts
- lib/domains/creator/types.ts

Existing planning-narrative.ts and tmp-preview/ are outside this change and were not edited. Temporary logs and the fake-data browser harness are under ignored .tmp/.

## C. Migration and access

The Discovery-only RPC discovery_normal_candidate_window is STABLE, SECURITY DEFINER with search_path fixed to pg_catalog, public, pg_temp. It checks discovery.read OR influencers.read, fails closed for null/false permission results, revokes PUBLIC/anon execution, and grants authenticated execution. Its private filter-candidate helper is STABLE, SECURITY INVOKER with the same fixed search path and execution revoked from PUBLIC, anon and authenticated. The server action also requires an authenticated user and validates request shapes and bounds. No service key is loaded by this path.

Both functions only read. Text retrieval reuses search_creators_impl; filter-only requests prequalify IDs in SQL before pagination and compact hydration. The migration does not change tables, Creator DNA history/merge/schema, RLS policies, indexes, or existing search function definitions. The migration and matching rollback were exercised only in an isolated loopback PostgreSQL fixture. Roll back application usage first, then run the explicit two-function DROP script under supabase/rollbacks; it uses no CASCADE. This is a revision of the unapplied draft migration. It requires separate review and approval before application to any Production database. Missing RPC fails explicitly; there is no fallback into acquisition.

## D. Preserved retrieval

Existing exact-handle, prefix, token/FTS and trigram retrieval remain in search_creators_impl. Existing profile URL/handle normalization is reused. An empty indexed first window permits a literal case-insensitive handle/name contains fallback (prefix for @handles), preserving stale-index fallback behavior without treating user %/_ as SQL patterns. Later empty pages cannot introduce unrelated fallback results.

Ordinary English/Arabic search text stays intact for the existing index. Both operands are normalized for in-memory comparisons. This does not rebuild the index or promise new Arabic stemming. Name/handle filters check the real display name and all account handles; display name never creates or reconciles identity. The existing public-profile readiness/synthetic-data gate is preserved. Canonical accounts take precedence over unlinked discovered copies of the same platform/normalized handle. Raw cursor progress survives dropped duplicate projections.

## E–H. Filter truth and evidence

This table supersedes the older Phase 0 truth matrix for the new normal-search path only. OR within each list/band dimension; AND between dimensions. Missing required evidence excludes a candidate from qualification, with Not available rather than a fabricated mismatch score. Missing irrelevant evidence has no scoring penalty.

| Control | Source and semantics | Missing evidence |
|---|---|---|
| Search | Existing indexed lexical candidate universe; existing identity normalization | No invented candidate |
| Name / handle | Actual display name or any account handle, normalized substring | Does not qualify |
| Creator country | Stored country codes, existing DNA country scalar and existing account/profile inference | Does not qualify |
| Category | Stored category taxonomy; existing family/uncategorized rules; geographic category values removed | Does not qualify, except explicit Uncategorized |
| Platform | Any selected platform; canonical aliases | Does not qualify |
| Followers | OR inclusive bands; legacy min/max if bands absent | Does not qualify |
| Engagement | Stored account engagement rate >= threshold | Does not qualify |
| Average views | Stored account avg_views >= threshold | Does not qualify |
| Creator language | Stored creator language codes, OR exact codes | Does not qualify |
| Creator niche | Stored DNA aiNiche / discovered AI niche, normalized substring | Does not qualify |
| Content keyword | All normalized query terms in stored bio/hashtags and bounded recent caption evidence | Does not qualify |
| Content tags | OR normalized tag substring in the same content evidence | Does not qualify |
| Recent activity | Publication posted_at only; within requested days and not future | Does not qualify |
| Audience geography | Genuine non-unavailable audience topCountries membership; zero share excluded | Does not qualify |
| Audience gender | Genuine selected audience share >= 50% | Does not qualify |
| Audience age | Largest positive observed audience age band overlaps selected inclusive range; deterministic band tie | Does not qualify |
| Thinkway minimum | Explicit stored Thinkway score only; separate from Relevance | Does not qualify |
| Audience interests | Disabled; legacy field mixes creator content/category imports | Old state stripped |
| Content language | Disabled; creator language is not content-language evidence | Old state stripped |
| Brand safety | Unavailable; no authenticity/Thinkway proxy | Old state stripped |
| Source confidence / AI score / Brand fit / price | Unsupported normal controls disabled; old values stripped | Never qualify through proxies |
| Creator gender/age; verification | No new normal control enabled; existing unavailable controls retained | No inferred demographic data |

Selected platform, follower range, engagement and views must all be satisfied by the same account. Metrics used by pool sorting come from that qualified account, preferring the stored default account when it qualifies.

Creator Country inference is intentionally preserved, including the existing account location signal historically named audience_country. That signal cannot qualify Audience Geography. Actual audience demographics cannot establish creator gender/age or creator location. Country-like taxonomy labels are removed from options, typed entries, restored filters and result categories.

Shared criterion evaluation also separates creator/audience geo and demographic keys, evaluates engagement maxima and verification explicitly, and does not claim those criteria match without checking.

## I. Inline search

Typing schedules a real 280 ms debounce. Each new draft cancels the earlier timer. Enter cancels the timer and submits immediately. External query reset/unmount cancels pending draft work. Normal results are guarded by the active AbortController and monotonically increasing request ID; an older response cannot overwrite a newer request. Aborting the client guard prevents publication of old results; it does not cancel a database statement already executing. Filter/sort changes reset page 1. Clear restores default filters, query and sort.

## J–K. Eligibility and exact relevance formula

Only qualified creators enter ranking. No score rescues a hard-filter failure.

There are up to five graded dimensions:

1. Text: use top-bar search, or name/handle input when search is empty. Normalize both query and evidence.
   - Exact full display name or account handle: 100.
   - Otherwise full-query prefix of display name or handle: 90.
   - Otherwise: round(80 * matched query token occurrences / total query token occurrences), when at least one token occurs in compact profile/content evidence.
   - Otherwise positive existing lexical/fuzzy retrieval rank: 40. This is an explicit coarse lexical tier, not a calibrated probability.
   - Otherwise unavailable (no numeric contribution).
2. Niche, only when requested and known: normalized exact niche 100; qualified substring niche 80.

3. Requested engagement minimum m > 0: on the same qualified metrics account, round(100 - 50*m/actual). At minimum this is 50; at twice minimum 75; the score saturates toward 100.
4. Requested views minimum m > 0: the same formula. A zero minimum supplies no meaningful relative scale and is not graded.
5. Requested content keyword: a contiguous phrase in retained evidence is 100; all terms dispersed in that evidence is 80. Hard token eligibility remains separate.

Displayed Relevance = rounded arithmetic mean of the available requested graded dimensions. One evaluable dimension is sufficient. With none, score is null and the UI says Insufficient data.

Country, platform, category membership, follower bands, Thinkway thresholds, content tag membership, recency and demographics remain binary qualification rules and contribute ZERO score points. Engagement/views thresholds still determine eligibility; only their measured relative headroom is graded separately. Stored categories/content can supply lexical text evidence, but passing their hard filter alone does not supply percentage points. Tag-only requests therefore show Insufficient data; an evaluable content phrase now supplies a graded dimension. Unknown evidence is not assigned zero and is not placed in the denominator. Thinkway, ECI, completeness, authenticity, fake follower estimates and Brand Safety never enter this formula.

This is contextual match strength, not campaign Match %, creator quality or a likelihood estimate. The response includes the same score used for sorting and per-criterion explanations.

## L. UI

No active supported query/filter context: no Relevance column or Relevance sort option. Active context: optional Relevance column with percentage or Insufficient data; expandable reasons use Match / Not available / Does not match and describe the text tier. The ordinary view does not expose creator-country confidence numbers. Visible sort and direction controls use the existing grid; no brief upload/AI/Match UI was added.

## M–N. Pool sorting, pagination and counts

Supported sorts: Relevance, name, platform, followers, creator country, categories, engagement, views, source, stored Thinkway and last synced. Requested direction applies to known values, nulls stay last, and unified creator ID breaks ties. No client quality precedence or exact/hybrid regrouping overrides normal server order.

Each complete 200-candidate retrieval window is qualified. When accumulated qualified candidates reach pageSize, the pool is sealed and sorted; otherwise another window is read. Exhaustion seals a smaller final pool. Completed pools are concatenated, and only those needed for the requested page are evaluated. At pageSize 24 a pool contains at most 223 unique qualified candidates. Exact name/handle matches precede other candidates within a pool, without changing displayed Relevance. Remaining sorting uses the requested field/direction and ID tie-break.

The same query, pageSize and stable catalog reproduce pool boundaries, so later pools never reorder earlier ones. Candidate IDs are deduplicated before qualification. Counts are lower bounds until exhaustion is actually observed. A bounded response is usable and supports load-more; it is not an error or a claim of catalog-wide ranking.

The existing 10,000-candidate and six-second safety limits remain. If a requested page cannot be supplied from sealed pools before a limit, the response is incomplete with an honest lower bound. No budget is extended. Later page requests currently replay earlier windows; Production verification found keyword page two returning a deterministic 24-row page in 6.701 seconds, beyond the between-window budget because the final RPC supplied the page. This remains a rollout latency concern.

## O. No search side effects

The normal workspace branch exits before legacy coverage/acquisition/enrichment paths. Its transport only invokes the new read-only RPC. SQL STABLE behavior is exercised inside BEGIN READ ONLY. No mutation transport is supplied to fixture tests. Empty searches cannot fall through to acquisition. Unmount/unload cancellation contacts the acquisition service only when an explicit acquisition job exists. Search execution does not enqueue search analytics through the old acquisition branch; explicit user interactions retain their existing workflows.

No Production access, data writes, backfill, Apify launch, migration application, deployment, commit or push was performed for this task.

## P–Q. Validation

Initial closure validation (before bounded execution): 196 tests passed, 0 failed, 0 skipped. Application TypeScript and the focused new-test type-check passed. Focused lint across 19 changed TypeScript files reports 11 pre-existing workspace errors and 8 pre-existing warnings; no new findings. Tracked and newly added file whitespace checks passed. Validation includes:
- Pure execution/filter/request matrix and timer tests.
- Existing category/follower/language/demographic/search-intent/page-fill/criterion regressions.
- Real PostgreSQL 17 fixture: original lexical functions + new migration, English/Arabic/@handle/name/prefix, fallback, multiple windows, source/feed scalar preservation, canonical identity dedupe, permission denial, anon denial and read-only transaction.
- TypeScript application check and focused test type-check.
- Focused ESLint against changed implementation/test files; comparison with HEAD to separate inherited findings.
- git diff --check.
- Local browser harness using actual toolbar/inline/row components and execution engine with 230 fake creators. Verified debounce, Enter without delayed duplicate, late best result, reason expansion, binary-context Insufficient data, filtered sort/page reset and clear. No browser console errors. This is component interaction QA, not an authenticated end-to-end run of the whole Next workspace.

Existing test repairs: audience-proxy expectations now reject proxies; campaign ranking fixtures needing audience evidence now supply genuine typed demographics. The existing simplify-query test expected uppercase Mohamed although unchanged canonical normalization returns lowercase mohamed; only that stale expectation changed.

## R. Performance and rollout risk

No new model calls, embeddings, full-catalog browser load, per-creator network queries or full DNA hydration. DNA reads project only country/niche scalars. Feed data is at most three small publication projections per account. Caption evidence is fetched only for content filters: first 30 retained posts/account, up to 1,000 characters/caption, capped at 12,000 joined characters/creator. This bounds evidence; it is not a claim of searching every historical caption. Recent-activity dates are scalar extraction from retained posts when requested. Source and avatar information remains projected.

Server memory is bounded by a window plus page*pageSize+1 candidates. Existing lexical retrieval is rerun for each SQL window and each requested result page. A genuinely broad remaining qualified universe may still exceed the scan/time budget; selective queries no longer spend that budget on all unrelated catalog rows. Filter-only requests now apply conservative database prequalification before LIMIT/OFFSET and hydration. Country/category/platform/follower/engagement/views/language/Thinkway predicates reduce the candidate universe; unknown location and exceptional alias cases remain for authoritative inference/evaluation. No Production-scale latency benchmark was run; local fixtures prove correctness, not operational capacity. Before rollout, review/apply the migration in an approved non-Production environment and measure representative broad/narrow requests. Do not remove the completeness guard to conceal slow execution.

## S. Remaining boundaries

- Production migration review/application and authenticated integrated smoke test remain outstanding by instruction.
- Representative catalog performance must be measured before rollout; selective retrieval has passed a local 24,503-profile fixture, while very broad requests can honestly remain incomplete.
- Focused lint has inherited workspace issues; no new lint findings are introduced by this change (see final results).
- No Phase 2 or Phase 3 work started. No Campaign Studio/Creator DNA architecture changes.
