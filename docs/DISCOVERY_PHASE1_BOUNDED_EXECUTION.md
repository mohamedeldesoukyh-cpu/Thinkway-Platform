# Phase 1 bounded normal Discovery

This supersedes the earlier exhaustive/global ranking requirement. Relevance formula, hard eligibility, inference and SQL retrieval priorities are unchanged.

## Pool rule

- Read a complete existing 200-candidate window and apply unchanged hard eligibility.
- Seal a pool when at least pageSize unique qualified candidates have accumulated, or retrieval is exhausted. Sparse matches fetch another window only to fill the pool.
- Sort each sealed pool: exact name/handle first, then requested field/direction, then stable creator ID. Exact lexical retrieval remains the upstream priority. Relevance values are unchanged.
- Concatenate sealed pools. Stop as soon as the requested page is available; never sort an expanding prefix that could displace earlier pages.
- At pageSize 24, a pool contains at most 223 unique qualified candidates: at most 23 carried from sparse windows plus the next 200. Typical pools use one window, providing ranking headroom beyond 24 rows. Do not fetch additional windows solely to chase a globally better score.
- Page-number requests replay the same boundaries for a stable query, pageSize, ordering and catalog. No server cache, cursor storage, acquisition or persistence is introduced. Replay has a latency cost on deeper pages.
- Deduplicate candidate IDs before qualification, while advancing by raw scannedCount. Retain all qualified candidates in their fixed pool order; no top-K truncation discards later-page candidates.

## Counts and UI

`bounded` means the requested page is available while the catalog remains unexhausted. It is a normal result and permits load-more. Its observed matching count is a lower bound and renders with `+`. `complete` supplies an exact count only after exhaustion. `incomplete` remains a safety-limit result when sealed pools cannot supply the requested page; the UI asks for narrowing or retry without claiming a global rank.

Binary filters supply no fabricated relevance variation. Other sorts apply within pools, not across the entire catalog. Later pools can contain higher values than earlier pools. Relevance measures the candidate against the active request, not against every creator.

The original six-second between-window check and 10,000-candidate guard remain. An individual final RPC can finish after six seconds and still complete the page; no timeout has been increased.

## Production read-only verification

Used the unchanged transport and updated pure execution engine against the installed RPC in one authenticated-role, read-only PostgreSQL session. These timings include SQL round trips and application qualification/ranking but exclude browser, Next server-action authentication and PostgREST overhead. No Production application deployment or SQL replacement was performed this turn.

| Request | Page 1 ms | Windows | Examined | Rows | Count | has_more | Page 2 ms / rows |
|---|---:|---:|---:|---:|---|---|---|
| Egypt | 381 | 1 | 200 | 24 | 102+ | true | 375 / 24 |
| Beauty | 512 | 1 | 200 | 24 | 74+ | true | 268 / 24 |
| Egypt + Beauty | 540 | 2 | 400 | 24 | 43+ | true | 848 / 24 |
| Instagram + followers | 319 | 1 | 194 | 24 | 194 exact | true | 307 / 24 |
| Engagement minimum | 268 | 1 | 200 | 24 | 200+ | true | 260 / 24 |
| Keyword beauty + Egypt + Beauty | 3214 | 2 | 400 | 24 | 43+ | true | 6701 / 24 |
| Combined country/category/platform/followers/engagement | 176 | 1 | 28 | 4 | 4 exact | false | 174 / 0 |

Every repeated second-page ID sequence matched. No overlap occurred between first and second pages. The combined request had only four eligible creators and correctly ended. Keyword page two returned a valid deterministic page, but its replay exceeded six seconds; it remains a performance concern before final rollout. No further SQL optimization was attempted.

## Repository and regression

Keep the installed `20260920150000_discovery_country_candidate_short_circuit.sql` migration and matching rollback. They remain uncommitted repository additions from the previous approved step. The historical migration is unchanged.

200 focused tests pass, including SQL regression, hard-filter correctness, one-window first page, pool-boundary pagination across 465 unique creators, duplicate input suppression, sparse-window qualification, exact identity priority, honest counts and read-only transport. Application and test TypeScript pass. Focused lint retains only the independently verified 11 errors/8 warnings already in HEAD. Whitespace checks pass.

No commit, push, deployment, Production data mutation, Apify, acquisition, enrichment, coverage write or Phase 2 work. First-page performance is corrected in the tested server execution path. Keyword second-page replay and authenticated deployed UI verification remain rollout limitations.
