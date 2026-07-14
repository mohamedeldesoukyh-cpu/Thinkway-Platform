# Campaign Intelligence SSOT Migration Plan

**Status:** approved design — not yet implemented
**Basis:** `docs/intelligence/BRIEF_FIDELITY_AUDIT.md` (empirical degradation report)
**Goal:** one canonical intelligence source (the Campaign Intelligence Profile) behind every
Studio field; zero duplicated parsing; zero demo templates presented as intelligence; zero
fabricated evidence. Target: **zero information loss between the user's brief and the Studio.**

---

## 1. Current state — dual intelligence

```
                     ┌──────────────────────────────────────────────┐
BRIEF ──────────────►│ PATH A (regex): extractCampaignFacts          │──► CampaignFacts SSOT
        (turn start) │  · parseBrand (8-brand whitelist)             │      │
                     │  · parseAudience / parseProduct (demo regexes)│      ▼
                     │  · detectIndustryFromBrief (6 demo verticals) │  strategy → specialists
                     │  · INDUSTRY_PROFILES templates                │  → sections → STUDIO
                     └──────────────────────────────────────────────┘
BRIEF ──────────────►┌──────────────────────────────────────────────┐
   (search-creators  │ PATH B (LLM): runCampaignIntelligencePipeline│──► CIP row
    task, mid-run)   │  · extract-profile-llm + validators           │      │
                     │  · heuristic fallback built in                │      ▼
                     └──────────────────────────────────────────────┘  discovery filters ONLY
```

Path B already understands what Path A destroys (`products[]`, `objectives[]`,
`creatorCategories[]`, `creatorNiches[]`, structured `audienceDetail`, `marketTier`) — but it
runs **after** facts/strategy are built and feeds only creator search. The bridge
(`profileToCampaignFacts`) already exists and is already used by the engine **when a validated
CIP is linked before the workflow starts** (workflow-engine init). The architecture is not
missing pieces; it is mis-ordered and half-wired.

### Inventory to eliminate

| Class | Location | Examples |
|---|---|---|
| Duplicated parsing | `format-utils.ts` parsers + `extract-campaign-facts.ts` vs `extract-profile-llm` | audience, product, objective, brand, market, duration, budget parsed twice with different quality |
| Demo whitelists | `parseBrandFromText` | 8 hardcoded brands |
| Demo industry taxonomy | `detectIndustryFromBrief` | 6 verticals + general; no beauty, healthcare, gaming, … |
| Template strings as intelligence | `INDUSTRY_PROFILES` | campaignType, creatorMixSummary, estimatedReach, platform defaults |
| Fabricated evidence | `getGroundedKpis`, success-probability meta | "Based on 47 similar luxury campaigns" (hardcoded constant), canned confidences |

---

## 2. Target architecture

```
BRIEF ──► CIP EXTRACTION (one pipeline: LLM → validators → heuristic fallback)
             │  extractionMode: "llm" | "heuristic"   (already exists)
             ▼
        CampaignIntelligenceProfile (canonical, persisted, versioned)
             │ profileToCampaignFacts (the ONLY facts producer)
             ▼
        CampaignFacts = projection of CIP (never independently parsed)
             │
             ▼
        DERIVATION LAYER (deterministic, provenance-tagged)
          · campaignType   ← derived from objectives (launch/awareness/conversion…)
          · estimatedReach ← computed from budget × CPM band × platform mix
          · creator mix    ← brief creatorCategories/Niches first; tier model second
          · industry       ← CIP.industry (open label) → canonical mapping
             │
             ▼
        strategy → specialists → sections → STUDIO
        every displayed value carries {value, provenance, confidence}
        provenance ∈ extracted | derived | computed | benchmark | default | user_provided
```

**Invariants (the same discipline as the Creator Intelligence migration):**
1. Never two extractors for the same field — `extractCampaignFacts`'s regex body survives only
   as the *heuristic fallback inside the CIP pipeline*, in one place, labeled `heuristic`.
2. Facts stay the read model — every existing consumer (strategy, specialists, summary cards,
   budget, timeline, governance, copilot, outputs) keeps reading `CampaignFacts`; only the
   producer changes. No consumer migration required for Phases 1–2.
3. Additive first, delete last. Every phase flag-gated; `off` is byte-identical.
4. No displayed value without provenance. "Benchmark" must name a real source or render as
   "heuristic model" — never as historical evidence that does not exist.
5. Missing business facts pause and ask (the governance self-repair loop already does this);
   the system never invents brand, budget, product, or audience.

---

## 3. Gaps to close before cutover (Phase 1 scope)

| Gap | Detail |
|---|---|
| `CampaignFacts.creatorTypes` | New field projected from CIP `creatorCategories`/`creatorNiches`; consumed by creator-mix derivation, strategy, discovery narrative. |
| `CampaignFacts.objectives[]` (funnel) | Multi-stage objectives (awareness/consideration/purchase intent) projected from CIP `objectives[]`; KPI derivation reads stages, not regex on a string. |
| Provenance envelope | Extend `sources` values with `llm`/`heuristic`/`user_provided`; add per-field `extractionMode`. |
| Brand-independent CIP persistence | `ensureWorkflowCampaignIntelligenceProfile` currently returns `undefined` when `detectBrandFromProfile` finds no brand match — extraction must persist with `brand_id = null` and link later; otherwise every unknown brand silently falls back to regex. |
| Latency budget | CIP extraction moves to workflow start. LLM extraction runs concurrently with `analyze-request` (both are turn-1 work); hard timeout (e.g. 8s) → heuristic fallback, mode recorded. |
| Fidelity telemetry | `[intelligence-fidelity]` diff log: regex facts vs CIP projection per brief, per field. |

---

## 4. Phased migration

### Phase 0 — Safety net (no behavior change)
- Freeze regression fixtures: the six demo briefs (BabyJoy, Rolex, Adidas, e&, Emirates NBD,
  Visit Egypt) + the L'Oréal audit brief; snapshot current facts + summary cards.
- Add the fidelity diff telemetry (shadow: compute CIP projection when a CIP exists, log
  field-level diffs vs regex facts, change nothing).
- **Gate:** telemetry visible in dev console/traces; fixtures green.

### Phase 1 — Schema + bridge (additive only)
- Extend `CampaignFacts` (creatorTypes, objectives[], provenance fields) and
  `profileToCampaignFacts`; extend the CIP LLM prompt/schema for product SKU + creator types
  where thin; decouple CIP persistence from brand match.
- No consumer reads the new fields yet.
- **Gate:** tsc/tests green; fixtures byte-identical.

### Phase 2 — Extraction moves to the front (flag: `CAMPAIGN_INTELLIGENCE_SSOT_MODE`)
- `ensureWorkflowCampaignIntelligenceProfile` runs at workflow start (concurrent with
  analyze-request) instead of at search-creators.
- **shadow:** CIP extracted up front, projection diffed and logged; regex facts still drive.
- **on:** `facts = profileToCampaignFacts(profile)`; regex runs only as the in-pipeline
  heuristic fallback (LLM unavailable/timeout), labeled `heuristic`, surfaced in Studio meta.
- This single cutover fixes audience, product, objective, brand (no whitelist), creator types
  at the SSOT — every downstream section improves without being touched.
- **Gate to "on":** shadow diff over N real briefs shows CIP wins or ties on every audited
  field; extraction failure rate < agreed threshold; resume/clarification flow re-verified
  (facts merge on resume switches to a CIP profile patch — same user experience).

### Phase 3 — Derived fields off the demo templates (per-field flags or one flag, field order fixed)
Migration order within the phase (lowest risk → highest):
1. **estimatedReach** → computed from budget × CPM band × platform mix; range + "computed"
   provenance. (Pure display; no downstream consumers.)
2. **campaignType** → derived from objectives (product launch / awareness / conversion / UGC…);
   industry becomes a modifier, not the source.
3. **industry** → CIP.industry (open label) with canonical mapping; `detectIndustryFromBrief`
   retained only inside the heuristic fallback.
4. **creator mix** → brief-first: requested creatorTypes drive the mix narrative and the
   discovery/tier composition; the tier model becomes the *allocation* layer under the
   requested categories; template mix survives only as a labeled default when the brief is
   silent.
5. **budget weights / CPM assumptions** → last in this phase (money-adjacent): keep current
   values but re-labeled as "heuristic model" until the Benchmark Library exists.
- **Gate per field:** governance fidelity checks (below) pass; demo fixtures updated
  deliberately (template strings disappearing is the *point* — fixtures assert the new derived
  values, reviewed by a human).

### Phase 4 — Honest evidence + fidelity gate
- Replace `getGroundedKpis` canned citations and success-probability meta with the provenance
  model: `{value, method: computed|benchmark|heuristic, source, confidence}`. Until a real
  performance knowledge base exists, "N historical campaigns" strings are **deleted** —
  heuristics say they are heuristics. (This is the seam where the future Knowledge Center /
  Benchmark Library plugs in without another migration.)
- New governance check class `fidelity_*` (extends the existing QA gate + self-repair loop):
  - `fidelity_audience_echo` — displayed audience must be traceable to brief text or carry
    non-extracted provenance (kills "Audience"-style heading captures permanently).
  - `fidelity_product_echo` — same for product.
  - `fidelity_no_fabricated_citations` — no evidence string without a named real source.
  - Classification: auto-fixable → re-extract/downgrade provenance; user-required → the
    existing missing-info pause asks for the field.
- **Gate:** governance green on fixtures + real briefs; UI renders provenance labels.

### Phase 5 — Legacy deletion (only after Phase 2–4 "on" in production)
- Delete: `parseBrandFromText` whitelist, `parseAudienceFromText`, `parseProductFromText`,
  `parseObjectiveFromText` as standalone parsers; `extractCampaignFacts` as an independent
  producer; `INDUSTRY_PROFILES` template display strings; fabricated citation tables; the
  shadow/diff scaffolding; finally the flag itself (SSOT becomes the only path).
- The heuristic fallback remains as ONE clearly-scoped module inside the CIP pipeline.
- **Gate:** grep-proof: no Studio field reachable from a regex parser or template string;
  audit script re-run shows zero degradations on the L'Oréal brief.

---

## 5. Component migration order (summary)

| Order | Component | Phase | Why this position |
|---|---|---|---|
| 1st | Campaign Summary card fields (audience, product, objective, brand, market) | 2 | Highest-visibility damage; pure facts display; fixed by the producer swap alone. |
| 2nd | Strategy document + specialists + KPI derivation | 2–3 | Read facts; improve automatically, then gain funnel-aware KPIs. |
| 3rd | Estimated reach, campaign type, industry, creator mix | 3 | Derived-field replacements, ordered by blast radius. |
| 4th | Benchmarks, grounded KPIs, success probability, budget weights | 3–4 | Money- and trust-adjacent; needs the provenance model first. |
| Last | Legacy parser/template deletion + flag removal | 5 | Only after production runs prove the SSOT path. |

**Explicitly unchanged:** workflow engine task structure, governance self-repair loop,
Creator Intelligence / Matching Engine, discovery search (already CIP-driven — it becomes the
*consistent* consumer instead of the only one), persistence and Studio rendering paths.

---

## 6. Failure ladder (rollout safety)

```
LLM extraction ──timeout/error──► heuristic fallback (same pipeline, mode="heuristic")
      │                                   │
      ▼                                   ▼
validated CIP                    facts labeled heuristic; governance fidelity
      │                          checks tighten; low-confidence fields become
      ▼                          user questions via the existing missing-info pause
facts projection                 (never silent, never invented)
```

Flag ladder per environment: `off` (byte-identical today) → `shadow` (diff telemetry) →
`on` (dev) → `on` (prod). Any regression: flip the flag back — no data migration to unwind,
because facts remain the read model throughout.

## 7. Risks and trade-offs

| Risk | Mitigation |
|---|---|
| LLM latency at turn start | Concurrent with analyze-request; hard timeout → heuristic; user already waits for an 8-task workflow. |
| LLM nondeterminism vs deterministic governance | Validators + validatedIntelligence layer already normalize; governance echo-checks catch drift; heuristic fallback keeps CI/offline deterministic. |
| Cost per brief | One extraction per campaign (it already runs today at search-creators — moving it is not a new cost; deleting Path A removes double work). |
| Demo fixtures regress | They must — deliberately. Fixtures are re-snapshotted per phase with human review, not silently. |
| CIP outage | Heuristic mode is the old regex behavior, clearly labeled; the product degrades to today's quality, never below it. |
