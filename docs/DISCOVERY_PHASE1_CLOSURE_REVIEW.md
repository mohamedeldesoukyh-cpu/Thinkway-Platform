# Phase 1 final closure review

Historical closure record. Its exhaustive/global ranking requirement and commit recommendation are superseded by DISCOVERY_PHASE1_BOUNDED_EXECUTION.md and the final product decision.

Local review only. No Production access, migration application outside the fixture, backfill, Apify run, commit, push, deployment or Phase 2 work.

## A. Relevance scenario matrix

Every scenario below activates the optional Relevance column. A missing required hard-filter value excludes the creator; it does not produce an eligible row with a fabricated score. With no active supported request, the column is absent.

| Scenario | Eligibility | Differentiates two eligible creators | When Insufficient data appears |
|---|---|---|---|
| A. Country only | Requested creator-country membership, including existing inference | Nothing; country membership is binary | Every eligible row |
| B. Platform only | At least one selected platform account | Nothing; membership is binary | Every eligible row |
| C. Follower range only | Qualified account falls within an inclusive selected band | Nothing; larger followers within a band are not inherently a closer fit | Every eligible row |
| D. Engagement minimum only | Qualified account meets minimum | Measured engagement relative to positive requested minimum | Zero minimum; a positive minimum requires measurable engagement to qualify |
| E. Country + follower range | Both conditions pass | Nothing; both are binary | Every eligible row |
| F. Country + category + followers | All conditions pass | Nothing; stored category membership has no strength signal | Every eligible row |
| G. Platform + followers + engagement | One account satisfies all three account constraints | Engagement headroom on that qualified account | Zero engagement minimum, with no other graded dimension |
| H. Keyword + filters | Existing lexical retrieval and all hard filters; explicit content keyword additionally requires all tokens | Text tier/token coverage; explicit content phrase versus dispersed terms; any requested engagement/views headroom or niche strength | No evaluable requested graded dimension; missing mandatory filter evidence instead excludes |
| I. Category/niche + filters | Category membership and/or known matching niche plus other filters | Category alone gives no points; requested niche exact match 100 versus substring 80; requested numeric dimensions also contribute | Category plus binary filters only; missing required niche instead excludes |

Equal Relevance uses the existing deterministic creator-ID tie-break. Users can explicitly sort by followers or other supported metrics. No hidden quality score differentiates binary matches.

## B. Small formula correction

Keep hard eligibility first. Relevance is the rounded mean of available requested graded dimensions:

- Existing text tiers: exact name/handle 100, prefix 90, token coverage rounded from 80 times coverage, positive lexical/fuzzy rank fallback 40; otherwise unavailable.
- Existing niche: exact 100, qualified substring 80.
- Requested positive engagement or views minimum: `round(100 - 50 * minimum / actual)` on the same qualified metrics account. At minimum: 50; at twice minimum: 75; approaches 100. Zero minimum has no meaningful relative scale and adds no dimension.
- Requested content keyword: contiguous normalized phrase 100, all required terms dispersed 80.

No graded dimensions means null / Insufficient data. Missing values are not zeros. Country, platform, category membership, follower bands and other binary conditions add no points. Unrequested engagement/views do not affect the score. This is a bounded contextual-fit heuristic, not a calibrated probability or percentage of filters passed.

## C. Filter-only retrieval correction

The existing server transport now passes normalized country codes/aliases, category, platform, follower bands, engagement/views thresholds, creator language and stored Thinkway minimum to the Discovery RPC. Blank-query retrieval applies conservative SQL predicates before LIMIT/OFFSET and profile hydration. Account platform/follower/engagement/views predicates apply to one account together. Nonblank text keeps the existing lexical function.

Unknown/noncanonical locations and exceptional platform aliases remain candidates for the unchanged authoritative evaluator. Category-family and inferred-country regressions are covered. SQL prequalification cannot grant eligibility. Compact candidate windows, global sorting and exact-count completeness rules remain intact.

Local PostgreSQL fixture: 24,502 influencers plus one discovered profile, including 250 relevant creators beyond 24,000 unrelated/earlier records. Each scenario completes, returns exact totals, and produces two nonoverlapping globally sorted pages:

| Request | Qualified total | Application candidates examined | Local ID-query EXPLAIN execution ms |
|---|---:|---:|---:|
| Egypt | 502 | 503 | 148.304 |
| Egypt + Beauty | 502 | 502 | 54.819 |
| Egypt + Beauty + Macro | 251 | 251 | 73.607 |
| Platform + follower range | 251 | 251 | 23.568 |
| Engagement minimum | 251 | 251 | 14.870 |
| Combined country/category/platform/followers/engagement/views | 251 | 251 | 57.848 |

These are cached local fixture measurements of the ID-window query, not network/end-to-end or Production capacity measurements. Additional regression rejects a creator whose followers and engagement qualify only on different accounts.

The application no longer consumes its work budget on every unrelated catalog profile for these selective searches. PostgreSQL may still scan compact columns to evaluate conservative predicates. A genuinely broad qualifying set, or many unresolved residual candidates, can still exceed the safety budget; completeness is never fabricated.

## D. Exact migration and security/performance review

Up: `supabase/migrations/20260920100000_discovery_normal_candidate_window.sql`.

Down: `supabase/rollbacks/20260920100000_discovery_normal_candidate_window.sql`.

This revises the unapplied Phase 1 draft; it does not require an already-deployed five-argument overload.

| Review area | Result |
|---|---|
| Read-only | Both functions STABLE and SELECT-only; real calls pass inside BEGIN READ ONLY. No acquisition, enrichment, coverage, account, publication or DNA mutations/calls. |
| Authentication | Server action calls authenticated getUser; anonymous database execution denied. No service-role credential introduced. |
| Authorization | Outer function explicitly checks existing discovery.read OR influencers.read and fails closed for null/false; denied fixture permission is tested. Fixture stubs the existing permission provider rather than reproducing deployed JWT/RLS configuration. |
| Definer/invoker | Outer RPC uses SECURITY DEFINER to expose the authorized compact read projection through the existing permission model. Private helper uses SECURITY INVOKER and executes with the outer owner's effective privileges. This intentionally relies on the explicit permission gate rather than caller table grants/RLS. |
| search_path | Both fixed to pg_catalog, public, pg_temp; application tables/functions explicitly schema-qualified; catalog built-ins resolve before public, temporary namespace last. |
| Grants | Outer EXECUTE only granted to authenticated; PUBLIC/anon revoked. Helper PUBLIC/anon/authenticated execution all revoked; tested inaccessible directly to authenticated. Owner retains normal privileges. |
| Injection/validation | Static parameterized SQL, no dynamic EXECUTE or interpolated SQL. Bounds reject invalid/null windows; filter object shape and byte size checked; action validates typed values. Malformed JSON members can error, never become SQL. Injection-shaped category tested as data and table remains intact. |
| Query/index strategy | Filter predicates applied before stable ID pagination and compact hydration; limit+1 establishes continuation. Existing influencer account owner lookup/index and latest-metrics strategy reused. Local plans include sequential scans, nested loops, account-owner index scans and sorts; not an index-only plan. No new indexes added. |
| Existing search compatibility | Existing exact/prefix/English/Arabic/fallback paths pass; search_creators_impl definition hash remains unchanged across migration and rollback. No replacement of existing search functions. |
| Rollback | Roll back application usage first; transactional DROP of these exact two signatures only, no CASCADE. Executed successfully against fixture; both functions absent afterward. |
| Scope | Functions and their permissions only; no tables, columns, policies, indexes, DNA model or unrelated schema changes. |

Large real catalogs still require representative non-Production latency measurement before deployment. The local evidence establishes selective retrieval correctness and bounded application transfer, not universally sublinear database work.

## E. Files additionally changed for closure

1. `lib/discovery/normal-search.ts`
2. `lib/discovery/normal-search-transport.ts`
3. `lib/discovery/normal-search.test.ts`
4. `lib/discovery/normal-search-sql.test.ts`
5. `supabase/migrations/20260920100000_discovery_normal_candidate_window.sql`
6. `supabase/rollbacks/20260920100000_discovery_normal_candidate_window.sql` (new)
7. `docs/DISCOVERY_PHASE1_IMPLEMENTATION.md`
8. `docs/DISCOVERY_PHASE1_CLOSURE_REVIEW.md` (new)

No UI redesign. Unrelated planning-narrative.ts, tmp-preview/ and concurrent campaign changes were not edited.

## F. Final tests/checks

- Full focused Discovery and relevant existing filter/search suite: **196 passed, 0 failed, 0 skipped**. Includes real isolated PostgreSQL migration, read-only transaction, authenticated/anonymous/denied permission, injection, late matches, aliases/inference, same-account constraints, global pagination and rollback regressions.
- Application TypeScript: **passed** on final rerun. An earlier snapshot caught concurrent campaign-type edits; no campaign files were changed in this task.
- Focused new-test TypeScript project: **passed**.
- Focused ESLint, 19 Phase 1 TypeScript files: **11 inherited errors, 8 inherited warnings, no new findings**. Independently ran ESLint on HEAD versions of the result-list and workspace files; rule/severity/message multisets match (line-number shifts normalized).
- Tracked git diff and newly added Phase 1 files: whitespace checks passed.
- Tests load only local fake fixtures; no Production/environment secrets or external data requests.

## G. Remaining Phase 1 blocker

None for a scoped Phase 1 commit. Applying the migration and authenticated integrated smoke/performance checks in an approved environment remain deployment steps, not completed by this closure review. Broad-query completeness guard and documented inherited lint findings remain explicit limitations.

## H. Recommendation

**GO for the scoped Phase 1 commit.** No commit, push or deployment performed. Exclude unrelated local artifacts and changes when staging.
