# Phase 1 bounded normal Discovery

This supersedes the earlier exhaustive/global ranking requirement. Relevance formula, hard eligibility, inference and SQL retrieval priorities are unchanged.

## Pool rule

- Read a complete existing 200-candidate window and apply unchanged hard eligibility.
- Seal a pool when at least pageSize unique qualified candidates have accumulated, or retrieval is exhausted. Sparse matches fetch another window only to fill the pool.
- Sort each sealed pool: exact name/handle first, then requested field/direction, then stable creator ID. Exact lexical retrieval remains the upstream priority. Relevance values are unchanged.
- Concatenate sealed pools. Stop as soon as the requested page is available; never sort an expanding prefix that could displace earlier pages.
- At pageSize 24, a pool contains at most 223 unique qualified candidates: at most 23 carried from sparse windows plus the next 200. Typical pools use one window, providing ranking headroom beyond 24 rows. Do not fetch additional windows solely to chase a globally better score.
- Authenticated normal pagination now carries an encrypted continuation containing unused sealed rows, the next raw offset, seen identities and cumulative counters. It resumes the same pool boundaries without replay. The pure engine retains page-number replay for equivalence testing. No server cache, database storage, acquisition or persistence is introduced.
- Deduplicate candidate IDs before qualification, while advancing by raw scannedCount. Retain all qualified candidates in their fixed pool order; no top-K truncation discards later-page candidates.

## Counts and UI

`bounded` means the requested page is available while the catalog remains unexhausted. It is a normal result and permits load-more. Its observed matching count is a lower bound and renders with `+`. `complete` supplies an exact count only after exhaustion. `incomplete` remains a safety-limit result when sealed pools cannot supply the requested page; the UI asks for narrowing or retry without claiming a global rank.

Binary filters supply no fabricated relevance variation. Other sorts apply within pools, not across the entire catalog. Later pools can contain higher values than earlier pools. Relevance measures the candidate against the active request, not against every creator.

The original six-second between-window check and 10,000-candidate guard remain. An individual final RPC can finish after six seconds and still complete the page; no timeout has been increased.

## Original bounded-execution verification (before continuation)

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

## Original bounded-execution repository and regression

Keep the installed `20260920150000_discovery_country_candidate_short_circuit.sql` migration and matching rollback. They were included in approved commit dcf10007ef5f4eda6175ce778d0335832af814de. This continuation correction changes neither migration nor rollback.

200 focused tests pass, including SQL regression, hard-filter correctness, one-window first page, pool-boundary pagination across 465 unique creators, duplicate input suppression, sparse-window qualification, exact identity priority, honest counts and read-only transport. Application and test TypeScript pass. Focused lint retains only the independently verified 11 errors/8 warnings already in HEAD. Whitespace checks pass.

No commit, push, deployment, Production data mutation, Apify, acquisition, enrichment, coverage write or Phase 2 work. First-page performance is corrected in the tested server execution path. Keyword second-page replay and authenticated deployed UI verification remain rollout limitations.

## Pagination continuation correction (uncommitted)

The server action authenticates each request. The continuation wrapper checks the existing discovery.read OR influencers.read permission even when the entire page is carried. It calls only those permission RPCs and discovery_normal_candidate_window. The dedicated server-only DISCOVERY_CONTINUATION_SECRET supplies 32 cryptographically random bytes encoded as canonical unpadded base64url. It derives the existing domain-separated AES-256-GCM key. Missing or malformed configuration fails closed. No service-role key, third-party credential, ephemeral runtime key or development default is used.

Tokens use a random 96-bit nonce, authenticated encryption, bounded compression/decompression (750 KB encoded input, 4 MB decoded output), a format version and 15-minute expiry. Authenticated associated data binds the canonical filters, keyword, sort, page size, next page number and authenticated user/context/project. Invalid, expired, mismatched or missing later-page tokens reject with a restart message. The UI discards continuation on fresh search/reset and ignores stale responses using the existing request guard.

Retained state consists of unused evaluated compact result rows (including their explanations and existing small feed previews), seen IDs, raw candidate offset, sealed/matched/source counts, exhaustion and the original eligibility evaluation time. Full Creator DNA is never retrieved or stored. Joined content evidence is removed after qualification. No database/session/cache subsystem was added. Repeated valid continuation requests are deterministic; invalidation is not a one-use token scheme.

The existing window size, pool threshold, lexical semantics, sorts, eligibility and relevance formula remain unchanged. The six-second between-window guard and cumulative 10,000-candidate limit remain. An incomplete result does not issue an advancing token. Catalog changes between requests retain the existing offset-pagination limitation: this is not a database snapshot. Sealed rows remain stable during the short-lived continuation.

Tests compare every page with replay across sparse/broad/keyword/identity/alternate-sort/exhausted fixtures, including duplicates at window boundaries, scores and reasons. The diagnosed 43-row pool returns 24, retains 19 and resumes at 400/600; its third page uses carry only. Request/user/context tampering, expiry, wrong keys and permission revocation are covered.

Production measurements run local updated server logic against installed RPCs in an authenticated-role READ ONLY transaction; they do not deploy or exercise the browser/Next authentication/PostgREST path. A process-local diagnostic encryption key is used because the exported Production environment does not expose its service-role secret. Runtime availability of the dedicated secret must be verified before deployment. Timings and final regression totals are recorded in the task report. No SQL, migration, indexes or Production data were changed.

### Final continuation validation

- Original 200 Phase 1 tests plus 23 continuation/security/secret-contract tests: 223/223 pass.
- Application TypeScript and focused test TypeScript pass.
- Changed-file lint: 11 errors / 7 warnings, identical to HEAD after normalizing shifted line numbers; no new findings.
- Broader Discovery sweep: 312/315 pass; exact-row, zero-results matched-criteria labels and campaign rank failures independently reproduce in the unchanged baseline. No unrelated repairs were made.
- Tracked and new-file diff checks pass.

| Request | Page 1 ms | Page 2 ms | Page 1 offsets | Page 2 offsets |
|---|---:|---:|---|---|
| Keyword beauty + Egypt + Beauty | 3532 | 3430 | 0, 200 | 400, 600 |
| Same keyword request, warm repeat | 3955 | 4056 | 0, 200 | 400, 600 |
| Egypt | 386 | 62 | 0 | none |
| Beauty | 384 | 62 | 0 | none |
| Engagement minimum 3 | 327 | 69 | 0 | none |
| Egypt + Beauty + Instagram + followers >= 500000 + engagement >= 3 | 257 | exhausted | 0 | none |

The combined query ended with seven rows, so no next-page request was sent. All other measured pages returned 24. Timings include the fresh permission check and token encode/decode; exclude browser, Next authentication and PostgREST transport. Keyword first/second-page result identity hashes match the pre-correction diagnosis.

Recommendation: GO to commit the correction and resume the separately approved deployment process after promotion review. The deployed end-to-end smoke check remains part of that future deployment, not this local verification.

### Final secret gate

The names-only Vercel inventory exposed invitation, readiness, cron and third-party credentials but no suitable general application encryption key. Invitation/readiness/cron credentials have separate access and rotation lifecycles, so none were repurposed. No shared variables were linked.

After explicit authorization, DISCOVERY_CONTINUATION_SECRET was saved as Vercel type Secret for Production and, separately, Preview restricted to develop. Each uses independently generated 32-byte cryptographic randomness encoded as canonical base64url. Values were never displayed, logged, written to repository files, or committed. No Development variable or unrelated environment setting changed. Metadata-only UI confirmation verified both scopes. No redeploy action was taken; existing deployments do not receive new environment settings until a new deployment.

The application reads only that dedicated server runtime variable, rejects missing/noncanonical/wrong-length values, and has no fallback. Local server-path tests set the variable with a cryptographically generated test value, issue and accept continuation across pages without replay, reject filter/user/context changes, tampering and expiry, and verify neither returned responses nor decoded continuation state contain the secret. The use-server action boundary and absence of secret references in the client workspace were checked; production browser/runtime verification will occur during the later authorized deployment.

Final checks: 223/223 Phase 1 tests; application and focused-test TypeScript passed; focused lint identical to HEAD (11 inherited errors, 7 warnings); tracked/new-file diff checks passed. Only the seven approved continuation files are in scope for the commit.
