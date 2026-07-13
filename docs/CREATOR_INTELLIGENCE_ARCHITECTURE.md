# Creator Intelligence Architecture

**Status:** Approved design direction — Phase 1 implemented (this document + `lib/creator-intelligence/`).
**Companion spec:** `docs/THINKWAY_SYSTEM_REFERENCE.md`, `docs/ARCHITECTURE_ALIGNMENT.md`.

## Vision

Thinkway is an **intelligence platform**, not a discovery platform. It has two
symmetric first-class intelligence domains:

- **Campaign Intelligence** — the canonical representation of a campaign
  (`CampaignFacts` on the Campaign Object; already the SSOT).
- **Creator Intelligence** — the canonical representation of a creator
  (`lib/creator-intelligence/`; introduced here).

**Discovery is an acquisition system.** It finds candidate creators and records
**provenance** (how/why a profile was acquired). It owns no intelligence.
**Enrichment resolves** raw evidence into intelligence. The **Matching Engine**
is the only place campaign requirements meet creator capabilities. Studio,
Director, Discovery browse, Ranking, Outputs, proposals, and future AI agents
all consume the same two intelligence models.

## Why this exists (the incident that proved the problem)

The E& regression traced to one architectural fault expressed as several bugs:

1. `discovered_profiles.category_tags` is written from the **discovering
   campaign's search intent** (crawl `coverageIntent`), wiped on re-crawl, and
   empty for trend/competitor crawls — yet Discovery **filtered** on it as if
   it were the creator's category. Mutable provenance consumed as intelligence.
2. Browse **displayed** `ai_category` (real intelligence from
   `profile_ai_scores`) while **filtering** on `category_tags` (provenance) —
   filtering, ranking, and display disagreed by construction.
3. The internal RPC matched categories case-insensitively; the discovery path
   used a case-sensitive array overlap — two divergent implementations of the
   same concept.
4. Zero results from provenance-filtering produced a **false insufficiency**
   signal that triggered external acquisition even though the database held
   6,000+ creators.

## Principles

1. **One source of truth** per attribute; per-attribute **source + confidence**
   metadata so consumers reason about trust instead of guessing.
2. **Provenance is never intelligence.** Acquisition metadata never feeds
   filtering, ranking, or display.
3. **No divergence** between filtering, ranking, and display — all consume the
   same resolver.
4. **No duplicated normalization.** One taxonomy module; normalizers are
   imported, never re-implemented (`resolveCountryCode`,
   `resolveDiscoveryPlatform`, `resolveCanonicalCategory`, …).
5. **Unknown ≠ fail, unknown ≠ pass.** Missing intelligence is discounted
   (`UNKNOWN_CRITERION_WEIGHT_DISCOUNT`), surfaced as an enrichment gap, and
   drives acquisition — it never silently zeroes a pool.
6. **Additive, flag-gated rollout.** Default behavior is byte-identical until a
   coverage-gated cutover.

## The model

### Key architectural decision: resolve over `UnifiedCreatorResult`

`UnifiedCreatorResult` is already the platform's unified creator read-model —
the merge point of `influencers`, `discovered_profiles`, Creator DNA hydration,
and `profile_ai_scores`. We deliberately did **not** build a rival model.
`CreatorIntelligence` is the resolved **semantic layer on top of it**:

```
influencers ─┐
discovered_profiles ─┤→ UnifiedCreatorResult ─→ resolveCreatorIntelligence() ─→ CreatorIntelligence
creator_dna (hydration) ─┤        (data read-model)        (the ONE resolver)        (semantic truth)
profile_ai_scores ─┘
```

### `CreatorIntelligence` (`lib/creator-intelligence/types.ts`)

Identity + per-attribute envelopes `{ value, source, confidence }`:

| Attribute | Resolution precedence | Notes |
|---|---|---|
| `categories` | Creator DNA → AI enrichment (`ai_category`) → bio inference | **Never** discovery `category_tags` (provenance) |
| `niche` | AI enrichment (`ai_niche`) | |
| `topics` | hashtags/AI themes → declared interests | normalized free-form themes |
| `languages` | declared `language_codes` | ISO 639-1 |
| `audience.primaryCountry` | demographics-backed → creator country proxy | ISO-2 |
| `brandSafety.level` | verification + authenticity heuristics | conservative: defaults **unknown**, never safe |
| `metrics`, `scores` | platform accounts / thinkway scores | pass-through summary |

### Taxonomy (`taxonomy.ts`)

One normalization façade: canonical categories **derived** from the existing
`CREATOR_CATEGORY_KEYWORDS` / `CREATOR_CATEGORY_LABELS` (never re-declared);
languages (ISO 639-1); ordered brand-safety scale where **unknown never passes
a minimum**; topic normalization. Re-exports `resolveCountryCode` and
`resolveDiscoveryPlatform` so this is the single import point for
normalization. `categoriesIntersect()` is the **only** category comparator —
canonical + case-insensitive by construction, which retires the internal-RPC
vs. array-overlap divergence at the semantic layer.

### Matching Engine (`matching.ts`)

`campaignRequirementsFromFacts(facts, {categories, topics, languages})` adapts
Campaign Intelligence into `CampaignRequirements` (callers pass intent-derived
categories; this layer never re-parses briefs). `matchCreatorToCampaign()`
evaluates per dimension — platform, country, category, topic, language,
followers, engagement, brand safety — each returning
`match | no_match | unknown` with a human-readable reason, and scores
`matched / (known + 0.5 × unknown) × 100`, reusing the exact unknown-discount
semantics of the existing campaign-relevance scorer. `eligible` = no hard
mismatch. This is the only campaign×creator comparison in the platform;
consumers must not re-implement their own.

### Coverage (`coverage.ts`)

`evaluateIntelligenceCoverage(profiles)` → per-attribute and per-platform
resolution coverage. This is (a) the **cutover gate** for migration phases and
(b) the signal **acquisition** should use: acquire when *intelligent supply* is
insufficient, not when a raw provenance column is empty.

### Rollout flags + shadow (`flags.ts`, `shadow.ts`, integration in `unified-browse.ts`)

`CREATOR_INTELLIGENCE_MODE`:

- `off` (default) — byte-identical legacy behavior.
- `shadow` — legacy behavior; logs `8_post_filter_ci_shadow` with
  `legacyPass / intelligencePass / recoveredByIntelligence /
  provenanceOnlyMatches / unresolved` so migration impact is measured on real
  traffic before anything changes.
- `on` — the category post-filter accepts creators whose **resolved
  intelligence** matches, with legacy tags as a union fallback so sparse
  enrichment can never shrink results below today's behavior during rollout.

## Consumers (target state)

| Consumer | Reads |
|---|---|
| Discovery browse/filter | CI categories/topics/language/audience via resolver |
| Acquisition gate | CI **coverage** (genuine intelligence gaps only) |
| Ranking / fit-rerank / relevance | `CreatorMatch.score` + breakdown |
| Studio slate proposal | matched, scored pool (then `composeCreatorSlate` for tier mix) |
| Director | requirement/breakdown reasons for strategy narrative |
| Outputs | the same CI attributes rendered in artifacts |

## Migration phases

- **P0 — Contracts (DONE):** taxonomy, types, resolver, matching, coverage,
  flags, shadow; tests; zero behavior change.
- **P1 — Shadow on real traffic:** set `CREATOR_INTELLIGENCE_MODE=shadow`;
  collect `8_post_filter_ci_shadow` telemetry; measure enrichment coverage.
- **P2 — Enrichment backfill:** AI-enrich creators with unresolved categories
  (prioritize active + TikTok + reach); track coverage per platform; respect
  `costProtection` caps.
- **P3 — Post-filter cutover:** `CREATOR_INTELLIGENCE_MODE=on` once coverage
  passes the gate (recommend ≥80% categories coverage on the target platform).
- **P4 — SQL-level migration:** persist a `creator_intelligence` projection
  (normalized, GIN-indexed) and repoint the SQL predicates
  (`searchDiscoveredProfiles`, `browse_influencer_ids_for_categories`) at it;
  values stored pre-normalized so predicates stay index-friendly.
- **P5 — Consumers:** ranking, Studio, Director, Outputs consume
  matches/resolver output directly; retire per-consumer category reads.
- **P6 — Provenance demotion:** `category_tags` becomes acquisition provenance
  only (conceptual rename `discovery_source_tags`); remove from all
  intelligence paths.

**Safety:** stored campaigns persist `creatorIds`, not attributes — existing
slates are immune. Dual-read union in `on` mode prevents result shrinkage.
Every phase is independently revertible via the flag.

## Performance

- Resolver is pure/synchronous over data already fetched by browse — no new
  queries; per-row cost is trivial relative to the existing hydration work.
- Shadow mode adds one in-memory pass over the post-filter pool (bounded by
  page size), only when enabled.
- P4's projection introduces the only new storage; GIN index on normalized
  arrays keeps SQL predicates index-backed (never wrap columns in `lower()`).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Sparse enrichment → CI-only filtering shrinks pools | union fallback in `on` mode; coverage-gated cutover; unresolved tracked in shadow reports |
| Backfill cost | phased, capped by `costProtection`, prioritized by demand |
| Taxonomy drift | canonical set derived from one keyword map; versioned at P4 |
| Divergence re-appearing | `categoriesIntersect` is the only comparator; code review rule: no new category comparisons outside `lib/creator-intelligence` |

## Future improvements

- Brand-safety enrichment (content risk signals) to move levels beyond the
  conservative verification heuristic.
- Audience-demographic matching dimensions (age/gender splits) in the engine.
- `creator_intelligence` persisted projection + event-driven refresh (P4).
- Director narrative generation from `CreatorMatchBreakdown` reasons.
- Retire `campaign-relevance-scoring` / `campaign-fit-rerank` bespoke logic
  onto the Matching Engine once parity is proven in shadow.
