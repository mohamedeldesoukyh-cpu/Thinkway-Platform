# Discovery Phase 2 — local implementation and validation

Base: `83ff5016a5d426254d5d86ef0457902522d74c93`. Isolated worktree: `C:/thinkway-platform/.tmp/discovery-phase2`. No commit, push, deployment, Production access, migration, backfill or Apify run.

## A. Existing intelligence reused

Existing upload/document parser, CIP extraction call, runCampaignIntelligencePipeline, normalization/validation, profile repository and save action. The existing Discovery mapper is adapted, not duplicated. No additional model/provider call or brief engine.

## B. Architecture

Upload → existing CIP → structured review/edit → explicit Use AI → validated requirements classification → supported selections plus soft preferences → authenticated existing Discovery action → existing read-only candidate RPC → Phase 1 hard eligibility → bounded qualified pool → contextual Match → encrypted deterministic continuation. CIP is loaded on the server through the authenticated existing repository; clients supply a profile ID rather than authoritative ranking facts.

## C. Exact changed files

- `docs/DISCOVERY_PHASE2_IMPLEMENTATION.md`
- `features/campaign-intelligence-profile/actions/profile-actions.ts`
- `features/campaign-intelligence-profile/services/campaign-understanding/build-campaign-understanding.ts`
- `features/campaign-intelligence-profile/services/discovery-campaign-requirements.ts`
- `features/campaign-intelligence-profile/services/discovery-search-mapping/creator-filter-pipeline-parity.test.ts`
- `features/campaign-intelligence-profile/services/discovery-search-mapping/discovery-search-mapping.test.ts`
- `features/campaign-intelligence-profile/services/discovery-search-mapping/map-campaign-intelligence.ts`
- `features/campaign-intelligence-profile/services/discovery-search-mapping/mapped-filters-to-discovery.ts`
- `features/campaign-intelligence-profile/services/discovery-search-mapping/types.ts`
- `features/campaign-intelligence-profile/services/extract-profile-llm.ts`
- `features/campaign-intelligence-profile/services/normalization/normalize-campaign-intelligence.ts`
- `features/campaign-intelligence-profile/services/normalization/types.ts`
- `features/campaign-intelligence-profile/services/normalization/validate-normalized-evidence.ts`
- `features/campaign-intelligence-profile/services/normalize-profile.ts`
- `features/campaign-intelligence-profile/services/semantic-separation.test.ts`
- `features/campaign-intelligence-profile/types/profile.ts`
- `features/campaign-studio/services/creator-search-requirements/creator-search-requirements-to-filters.ts`
- `features/campaign-studio/services/creator-search-requirements/csr-discovery-preservation.test.ts`
- `features/campaign-studio/services/creator-search-requirements/csr-search-wiring.test.ts`
- `features/campaign-studio/services/creator-search-requirements/shadow-compare.test.ts`
- `features/discovery/components/creator-search/creator-search-active-filters.tsx`
- `features/discovery/components/creator-search/creator-search-brief-panel.tsx`
- `features/discovery/components/creator-search/creator-search-result-list.tsx`
- `features/discovery/components/creator-search/creator-search-suite-row.tsx`
- `features/discovery/components/creator-search/creator-search-top-bar.tsx`
- `features/discovery/components/creator-search/creator-search-workspace.tsx`
- `features/discovery/normal-search-action.ts`
- `lib/discovery/brief-search.test.ts`
- `lib/discovery/brief-search.ts`
- `lib/discovery/normal-search-continuation.ts`
- `lib/discovery/normal-search-transport.ts`
- `lib/discovery/normal-search.ts`

## D. Brief UI

Compact Add Campaign Brief / Review / Use AI / Remove controls. Native Thinkway Sheet, Input and Button components. Upload/replacement prepares requirements without starting search. File name, error/status, editable requirements, classification/source disclosure and detach action. Detaching does not delete the stored document. No original-file download capability was added.

## E. Requirements

Creator countries/languages, content language, audience countries/languages/gender/age, platforms, categories, tiers, follower limits, engagement, niches and topics are editable separately. Budget/currency, campaign dates, objective and deliverables remain context. Other mandatory requirements are retained as not evaluated. Existing extraction/source evidence is retained where unchanged; explicit operator edits use existing provenance fields.

## F–G. Mapping and classification

- HARD: explicit supported creator country/language, platforms, category, tier/follower range and engagement minimum.
- SOFT: supported niche/topic evidence. These rank eligible candidates and do not exclude candidates for missing evidence.
- CONTEXT: market, client/brand, budget, dates, objective, deliverables and other campaign planning facts.
- UNSUPPORTED: audience demographics/interests, content language, gender, subjective image/tone, brand safety and unresolved requirements. No proxy filters or fabricated confidence.

Tier alternatives are intersected with explicit follower limits. Contradictory constraints produce a controlled review error rather than silently dropping a requirement.

## H. Manual ownership

Existing chips identify AI selections. Manual additions, changes and removals own the dimension, including empty values; rerunning AI preserves them. Follower limits/ranges form one linked ownership group. Ownership and disabled soft preferences survive the search URL. Clear retains the brief; removing the brief disables Match and returns to normal Relevance with the remaining manual filter state.

## I–J. Match and explanation

Phase 1 eligibility remains authoritative. Brief scoring reuses its contextual text evaluator for supported soft evidence and averages available contextual scores with the normal-request score. Binary eligibility does not manufacture variation. No evidence yields Insufficient data. Thinkway Score and unsupported preferences cannot affect Match. Reasons list actual evaluated dimensions and explicitly identify not-evaluated requirements; percentages are contextual evidence scores, not a claimed probability of campaign success.

## K–L. Normal search and unsupported dimensions

Without a brief evaluator, the existing normal evaluator and transport defaults are unchanged. Creator Country inference is unchanged. Audience Country and Audience Interests remain unavailable as functional filters. The requirements editor can preserve these wishes without making them eligible search dimensions.

## M. Continuation

Existing pool size, six-second budget, candidate windowing, token format/encryption, expiry and permission recheck are retained. Optional evaluator plumbing uses the same executor. The authenticated token context also binds the profile ID, mapped requirements and disabled soft choices. Brief/filter changes invalidate continuation. A fixture with 240 candidates returns pages 1 and 2 from one fetched window (offset [0]); the two pages have 48 distinct creators. Existing tampering/expiry/context/permission tests remain passing.

## N. Performance

No per-creator model call, remote DNA lookup or second ranking service. Soft preferences request the existing compact content projection. Ranking remains bounded by Phase 1. The final 37-test focused run took approximately 491 ms locally; this is test runtime, not live search latency. Production/provider latency was not measured.

## O. Side effects

The search path uses existing permission and candidate read RPCs, plus authenticated CIP reads. Unit transport assertions allow no write calls. Upload/save intentionally use existing document/CIP persistence when used by an authenticated user. Browser QA mocked those actions and wrote no service data. No acquisition/enrichment/coverage/DNA workflow was connected to the new AI action; no actor, migration or backfill was run.

## P. Responsive QA

Real new panel/chip components were bundled in an ignored local fixture with mocked upload/save actions. Desktop and 390×844 mobile checks verified scrolling, accessible footer actions, editing comma-separated countries, explicit AI run, AI chips, manual removal surviving rerun, clear retaining the brief, removal, and replacement reaching review without auto-search. Budget/currency/date fields were checked in the final rendered form. The final micro-review additionally exercised the complete workspace locally, as detailed below. Neither fixture constitutes authenticated hosted or live provider QA.

## Q. Tests

- New semantic + brief tests: **37/37 passing**, including all 12 required creator/audience examples, legacy stored CIP loading, fail-closed provenance, ownership, intersection/conflict handling, Match isolation, hard eligibility, unsupported disclosures, pagination/no-replay and continuation invalidation.
- Broad CIP / Campaign Intelligence / relevant Studio / Discovery / Phase 1 browse sweep: **1,409 tests; 1,405 pass; 4 fail**.
- All four failures independently reproduced on unchanged approved base `83ff5016...`:
  1. Studio strategy-score-isolation: “Strategy generation is grounded in facts, and its defaults are visible” source assertion.
  2. creator-search-exact-row: actual category Food versus expected Beauty.
  3. creator-search-zero-results-recommendations: describeMatchedCampaignCriteria legacy expectation.
  4. rank-browse-for-campaign: legacy ordering expectation.
- No tests disabled to obtain these results. SQL fixture uses isolated loopback PostgreSQL; no Supabase connection.

The semantic extraction fixtures mock recorded model responses while exercising the real existing extraction/pipeline/normalization/mapping. They prove the contract boundaries, not unrestricted model accuracy on arbitrary briefs.

## R. Checks

Application TypeScript and focused test TypeScript pass. Focused lint: **11 inherited errors / 6 inherited warnings; zero new signatures**, compared by rule, message and source line against the unchanged baseline (11 errors / 8 warnings). Two callback warnings were removed while wiring the new callbacks. Tracked and new-file whitespace checks pass. Production-mode Turbopack build is covered by the final micro-review below; no deployment.

## S–T. Remaining issue and recommendation

**GO for a scoped Phase 2 commit review.** No new functional/type/lint blocker identified in local validation. The four baseline failures remain disclosed. Authenticated integrated upload/provider/search QA remains a release gate before deployment; it was not run against Production. Do not treat the local component fixture as proof of a complete deployed server-action path.

## U. CIP semantic separation

Backward-compatible optional creatorRequirements and contentLanguages fields, plus existing provenance excerpts, separate market, audience country/language/gender, creator country/language/gender, tiers and engagement. New extraction marks explicit scopes so legacy heuristic gap filling cannot reintroduce country proxies. Market no longer fills audience geography, and audience geography no longer fills market or creator country. New creator values without their own adequate evidence are excluded with an extraction issue. No second parser/LLM service.

## V. Compatibility

Stored CIPs without new fields continue loading; no backfill. Existing shared consumers retain their APIs. The only Studio runtime edit is the exhaustive label for the new creator_tier mapping key; no Studio workflow or Studio→Discovery integration. Relevant consumer tests were updated only where their old expectations relied on the removed audience/market proxy or inferred hard filters. Unrelated baseline failures remain unchanged.

## W. Explicit creator-vs-audience results

All twelve required fixtures pass through the existing pipeline. Audience Egypt does not create Creator Egypt or market; market Egypt does not create audience or creator geography; explicit Egyptian creators do create Creator Country; Saudi audience stays separate; creator Arabic, content Arabic and audience Arabic remain separate; creator/audience female remain distinct and unsupported; ambiguous “in Egypt” produces no hard creator country; macro/Beauty/platform survive; no stated creator country means no generated creator-country filter. No display-name identity logic or historical data cleanup was introduced.


# Final micro-review — 2026-09-21

## A–B. Scope and demonstrated corrections

Reviewed all 32 files listed in section C. All belong to semantic separation, brief review, mapping, ownership, Match, existing execution/continuation plumbing, or their tests/documentation. No unrelated files or Phase 3 features were added. No file was removed. Removed an unused initial-brief-search ref and unused strategy-sheet state/reset remnants.

Four demonstrated defects corrected within the existing file set:

1. Soft-only brief searches no longer have Match sort reset to Followers by the normal-search context effect.
2. Identical niche/topic preferences are deduplicated case-insensitively rather than counted twice.
3. A creator name alone no longer earns 100% for a soft topic. The existing contextual evaluator receives blank names/handles and zero unrelated retrieval rank for this topic-only evaluation. Normal identity/name search is unchanged. The failing regression produced 100 instead of null before correction.
4. Subjective keyword preferences such as sophisticated remain visible as unsupported/not evaluated instead of disappearing. They do not score or filter.

No scoring redesign, new engine, SQL, migrations, provider, or Studio strategy change.

## C. Real-pipeline semantic matrix

Recorded model responses exercise the real parser/extraction pipeline, normalization, validation and mapping. This is contract verification, not a live-model accuracy claim.

| Request | Result |
| --- | --- |
| Campaign will run in Egypt | Market EG; no creator country |
| Target audience is in Egypt | Audience EG, unsupported; no creator country |
| We need Egyptian creators | Creator country EG |
| Egyptian creators targeting Saudi audiences | Creator EG; audience SA unsupported |
| Arabic-speaking creators | Explicit supported creator language ar |
| Content should be Arabic | Content language ar, not evaluated; no creator-language inference |
| Arabic-speaking audience | Audience language ar, unsupported; no creator language |
| Egypt campaign targeting Egyptian consumers using Macro Beauty creators | Market EG; audience EG unsupported; Macro + Beauty; no creator country |
| Egyptian Macro Beauty creators for an Egypt campaign | Creator EG; market EG; Macro + Beauty |

## D. Shared compatibility

Legacy CIPs lacking the optional fields load without a backfill. Existing parsing, editing, normalization, validation and persistence contracts remain covered. Studio runtime changes are limited to the exhaustive creator-tier label; strategy/workflow modules are unchanged. Shared semantic corrections intentionally remove unsafe audience/market proxy mapping; this is the approved CIP prerequisite, not a claim that old proxy outputs are preserved.

## E–G. Actual local workspace flow, mapping and ownership

Mounted the real CreatorSearchWorkspace and its actual panel, filters, chips and result components with Thinkway CSS. Local action adapters use the real TXT parser, real CIP pipeline with recorded response, in-memory profile persistence, real briefRanking and real runContinuedNormalSearch over synthetic candidates.

Verified fresh Discovery → upload → processing → editable requirements → explicit AI run → selected chips → results → Match explanation → manual refinement → pagination → brief removal → normal Relevance. The user never visits Studio. Replacement/review does not automatically run search.

Explicit Egyptian + Instagram + Beauty + Macro maps only those supported requirements; Saudi audience stays disclosed as not evaluated. Market, audience languages/interests, image preferences and gender do not invent supported filters.

Removed Macro, selected Mega, changed engagement to 5, then changed sort/query, reopened the panel and explicitly reran AI. Mega and engagement 5 remained manually owned. URL round-trip and multiple-override regressions pass. Soft-only Match sorting also verified in the actual workspace.

## H. Exact Match seam

CIP → mapCampaignIntelligenceToDiscoverySearch → supported hard filters and separate soft/context/unsupported requirements → briefRanking → evaluateNormalCandidate → existing bounded normal-search executor → existing relevance sort field → Match-labelled result and reason display.

Hard filters gate first. The base contextual score and each available supported soft-topic contextual score are averaged; missing scores are omitted. Binary eligibility, context and unsupported requirements contribute no invented score. No available score yields Insufficient data. Soft topics cannot borrow names/handles or another query's FTS rank. Thinkway Score is independent. The same computed score is carried, sorted and displayed.

## I–J. Continuation and normal mode

Requirements/profile binding and disabled AI soft selections join existing authenticated continuation context. Tests reject old continuation after requirement, AI selection, manual filter, query, sort and brief-removal changes. Real local workspace pages 2 and 3 fetched zero additional candidate windows from the carried pool; the first two pages contained 48 distinct creators, with descending displayed scores. The lower-level 240-candidate fixture also confirms no replay and deterministic retries.

Removing the brief restored normal Relevance; the final normal Beauty query returned contextual scores of 80 and no Match mode. Existing no-brief evaluator/transport defaults, Creator Country, disabled Audience Country/Interests and continuation remain covered by the broader suite.

## K–L. Responsive UI and side effects

Desktop and 390×844 mobile checks verified compact brief controls, visible attachment identity, requirement editing, clear processing, chips, manual drawer, Match explanations, removal and usable scrolling/footer. The existing wide results table retains its horizontal scrolling; no Phase 3 responsive redesign.

Observed local actions were chrome loading, brief upload/save and normal Discovery search. The search adapter rejects other server actions; transport regressions permit only permission/candidate reads. The new AI path does not enable legacy acquisition mode. Brief persistence is an intended existing write path; no Apify, acquisition, enrichment, coverage or DNA write is connected to search.

Limit: this is complete workspace interaction with local service adapters, not the authenticated Next server-action/Supabase/RLS transport or live provider. Hosted authenticated integration remains a deployment acceptance check. No Production services/data were accessed.

## M. Independently reproduced baseline failures

Exact unchanged baseline: `83ff5016a5d426254d5d86ef0457902522d74c93`. Targeted baseline run: 14 tests, 10 pass, four fail. Same failing assertions in the broader Phase 2 run:

| Test | Identical baseline failure |
| --- | --- |
| Strategy generation is grounded in facts, and its defaults are visible | Source assertion expects the old facts.objective fallback to Brand awareness and engagement |
| creator-search-exact-row.test.ts | Category actual Food; expected Beauty |
| describeMatchedCampaignCriteria returns human labels for matched filters | Missing expected Same audience country label |
| rankBrowseCreatorsForCampaign orders creators by campaign relevance | Actual inf:weak; expected inf:strong |

No unrelated baseline failure was fixed or skipped.

## N–R. Final validation and decision

Final scope remains the exact 32 files listed in section C: 27 modified and five new, all unstaged. Local harnesses/logs are ignored artifacts, excluded from that set. Existing root-workspace changes, including planning-narrative and tmp-preview and concurrent billing work, were not modified.

Final tests: 37/37 focused semantic/brief tests; broader sweep 1,409 total, 1,405 pass and the four reproduced baseline failures. Application TypeScript and focused test TypeScript pass. Focused lint remains 11 inherited errors / 6 inherited warnings versus baseline 11 / 8, with zero new rule/message/source-line signatures. Tracked and new-file whitespace checks pass. Production-mode Turbopack build passes with dummy localhost Supabase configuration and no live service credentials. No remaining demonstrated Phase 2 defect: GO for scoped commit, not deployment acceptance. Authenticated hosted integration is not claimed. No commit, push, deployment, Production access or Phase 3 work was performed.
