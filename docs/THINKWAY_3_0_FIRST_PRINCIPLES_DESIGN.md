# Thinkway 3.0 — A First-Principles Design

**Premise:** Found Thinkway today, mid-2026. Ignore the current UI and workflows. Keep only four assets: **Creator DNA**, the **historical warehouse**, **campaign intelligence** (brief understanding + provenance), and the **commercial engine**.
**Then:** map the design back onto today's codebase — reuse, evolve, retire.

---

# Part I — First principles

## 1. The job to be done

An agency team receives a brief and a budget. They must turn it into a **staffed, priced, executed, measured campaign** — and keep their margin intact while doing it. Everything else is decoration.

Deconstructed, the work is a chain of **decisions with money attached**:

1. *What is this campaign really trying to do?* (interpretation)
2. *Who should be in it?* (staffing)
3. *What will each of them cost, and what will they return?* (pricing & forecasting)
4. *Does the client believe it?* (evidence & presentation)
5. *Did it work, and what did we learn?* (settlement & memory)

A strategy team is not a search engine with taste. It is a group of people who **carry priced memory of past campaigns** and apply it under uncertainty. That memory — not the reasoning — is the scarce asset. In 2026, reasoning is a commodity you rent by the token; **calibrated, proprietary memory is the moat**.

## 2. Founding axioms

**A1 — One object.** A campaign is a single object from brief to settlement. Not a profile *and* a facts record *and* a working document *and* a quotation that reference each other — one versioned object whose facets are views. Every fragmentation of the campaign object eventually becomes a lie somewhere.

**A2 — Every claim carries provenance.** Any sentence the system produces about money, people, or predictions must be traceable to a brief span, a DNA field (with source and freshness), or a warehouse benchmark (with sample size and period). If it can't cite, it can't say.

**A3 — Staffing is portfolio construction, not ranking.** A top-N list is the wrong abstraction. A strategy team builds a *slate*: a set of creators that jointly satisfies budget, tier mix, audience coverage, language, and risk diversification. Individual "fit scores" are inputs to an optimization, not the answer. (No competitor models it this way; every discovery tool ships a leaderboard.)

**A4 — Every plan is a forecast; every forecast gets scored.** Plans state expected cost, reach, and engagement **as ranges with confidence**, derived from historical distributions. When the campaign settles, forecast-vs-actual is recorded. The system's *calibration* — "our cost forecasts land within the stated band 83% of the time" — is a first-class, sellable metric. This converts the warehouse from an archive into a learning system.

**A5 — Uncertainty is explicit, and questions must earn their place.** Missing brief information becomes an **assumptions ledger** (each assumption states its downstream impact). The system asks the user a question only when the answer would *change a decision* (value-of-information test) — never a 20-field intake form, never silent guessing.

**A6 — Missing data discounts confidence; it never disqualifies.** A creator we know little about may be the best choice. Unknowns produce "verify before contracting" tasks, not exclusion.

**A7 — Conversation for intent, documents for decisions.** People steer with chat; they approve, share, and sign documents. Chat is ephemeral; the document is truth. The agent's output is always an edit to the document, never just a reply.

**A8 — Deterministic guards around probabilistic cores.** Models draft; code validates (budgets sum to 100%, margins above floor, every creator exists, every citation resolves, timelines client-facing). Guards are non-negotiable and non-model.

**A9 — Execution must live in-product**, because the flywheel (A4) only spins if actual prices, delivery reliability, and results flow back automatically. Planning-only tools starve their own memory.

## 3. The product

Three nouns, five verbs, one agent.

### The nouns

**The Campaign Room** — one workspace per campaign. Left: the **Campaign File**, a living, versioned, sectioned document (understanding, assumptions, strategy, slate, budget, forecast, timeline, status). Right: the **Campaign Agent** chat. Bottom: artifacts generated from the File (quote PDF, client deck, contracts list). The Room *is* the campaign; there is nowhere else to go.

**The Roster** — the agency's creator asset, reframed from "profiles" to **mini-P&Ls**: for each creator, what they actually charged (per platform/format/period), what they actually delivered (went-live reliability, engagement vs promise), who they worked for (competitor exposure), and how well we know them (confidence per facet). Backed by Creator DNA + warehouse joins. Browsing the Roster feels like reading a scouting book, not filtering a database.

**The Memory** — the warehouse, surfaced everywhere as citations: pricing curves (creator × platform × format × period), category benchmarks (cost/ER/margin percentiles with n), and the calibration record. Never a separate "analytics module" — Memory has no home page; it appears inline wherever a number is claimed.

### The verbs

```
BRIEF ─► PLAN ─► PRICE ─► RUN ─► LEARN
```

**Brief.** Drop anything — PDF, deck, email thread, voice note. The agent extracts (with per-field provenance), *interprets* (brand tier, cultural context, competitive frame, seasonal timing), and produces the **understanding section + assumptions ledger**. It asks at most a handful of questions, each tagged with why it matters ("Budget currency changes creator mix: SAR 500K buys 2 macro or 9 micro").

**Plan.** The agent builds the slate: hybrid retrieval over the Roster (hard constraints → semantic similarity → evidence-cited re-rank) feeding a **portfolio optimizer** under budget/tier/coverage/risk constraints, priced by the commercial engine with rates from Memory. Output: a slate with per-creator evidence ("matches: KSA beauty audience 78% female — demographics provider, May 2026; charged SAR 42K for reel+story bundle, Nov 2025"), portfolio-level coverage view, and named alternates. Gaps trigger **targeted acquisition** ("we lack Arabic-first beauty macros in KSA — acquiring, ETA 20 min") that streams into the slate as it lands.

**Price.** One click: slate → quotation via the commercial engine, margin checked against historical percentiles ("this margin is P25 for the category — below your usual floor"), FX handled, serials assigned. The client-facing version of the File (strategy narrative + slate + forecast + price) is shareable with approval capture.

**Run.** Approved quote → campaign header/lines, creator outreach status, deliverables, go-live tracking, billing. (This exists today as the operational platform and is mostly right.)

**Learn.** At settlement, actuals flow automatically: paid rates → Creator DNA commercial envelopes; delivery reliability → DNA historical performance; outcomes and margins → warehouse marts; forecast-vs-actual → calibration record. Nobody fills in a retro form; the system settles like a ledger.

### The agent

One **Campaign Agent** per Room — a reasoning-tier model in a tool loop, streaming edits into the Campaign File:

| Tool | Backing |
|------|---------|
| `parse_brief` | campaign-intelligence extraction (provenance-preserving) |
| `interview` | assumptions ledger + VOI-gated questions |
| `retrieve_creators` | filters + DNA embeddings + re-rank with citations |
| `build_slate` | portfolio optimizer (constraints from File) |
| `price` | commercial engine + Memory pricing curves |
| `forecast` | benchmark distributions + uncertainty bands |
| `acquire` | enterprise acquisition queue (gap-targeted) |
| `edit_section` | provenance-carrying writes to the File |
| `validate` | deterministic guard suite (A8) |

Every write passes the guard suite; every guard failure returns to the agent as a correction instruction, not a user-facing error. Specialist "personas" are prompts within this loop, not a fixed pipeline — the agent decides what to do next based on the File's state, and it can loop (search → thin results → relax follower band → re-search) the way a human researcher does.

### What we deliberately do not build

A global 250M-creator index (Modash's game), media buying, generic chat, or a standalone "AI features" tab. The AI is the colleague in the Room, not a feature.

## 4. Why this wins

- **Vs Modash/Captiv8:** they answer "who exists"; we answer "who should be in *this* campaign, at what price, with what expected return — signed and invoiced." Their data is public-scrape breadth; ours is transactional truth.
- **Vs CreatorIQ/GRIN/Aspire:** they are systems of record; we are a system of *decisions* whose record grows more valuable with every campaign (calibration compounds; CRUD does not).
- **Vs ChatGPT-with-a-brief:** identical reasoning engine, but ours holds 14K priced campaign lines, per-creator paid rates, and a guard suite that makes hallucination structurally impossible to ship to a client.
- **Flywheel:** every campaign executed makes the next plan cheaper to produce and more accurate — the classic compounding loop none of the discovery tools can start, because they don't touch execution money.

---

# Part II — Mapping 3.0 onto today's architecture

## 5. Keep as-is (the four assets, plus quiet superpowers)

| Today | 3.0 role | Notes |
|-------|----------|-------|
| **Creator DNA** (`features/creator-dna`: envelopes, merge engine, lifecycle, completeness, IPL raw-first snapshots) | The Roster's data layer | Already provenance-perfect (A2, A6). Additions only: embedding vectors per facet; an **economics facet** populated from settled campaign lines (paid rate, reliability) — the Learn verb writing into existing envelope machinery with source `campaign` (already the 2nd-highest priority source; the design anticipated this). |
| **Historical warehouse** (`intelligence` schema, ETL, `int_pricing_history`, `int_benchmarks`, entity resolution) | The Memory | Keep isolation from operational billing. Additions: live-campaign settlement ingestion (today it's historical-only), calibration mart (forecast vs actual), pricing-curve mart keyed to resolved creator IDs. |
| **Commercial engine** (`lib/commercial`: 3-mode math, FX/EGP, agency fee; quotation serials/versioning/promotion) | The Price verb | Unchanged core. Add a thin `price_slate` wrapper (slate → normalized lines → totals) and a margin-floor guard fed by Memory percentiles. |
| **Campaign intelligence extraction** (`extract-profile-llm`, normalization, `fieldProvenance`, structured brief parser) | `parse_brief` tool | Keep the extraction-only discipline; add the interpretation pass on top; upgrade the model via config. The provenance plumbing is exactly what A2 requires. |
| Grounding/parity validators (ERS gates), budget-100% and timeline rules, approval-gate concept | The guard suite (A8) | Today's most underrated code. Repackage as a single `validate` tool; extend with citation-resolution and margin-floor checks. |
| Enterprise acquisition infra (BullMQ queue, Apify import pipeline, control center, cooldowns, usage tracking) | The `acquire` tool | The async shape, cost governance, and session-abort logic carry over intact. Only the *trigger* changes: slate gaps (specific tier × geo × language shortfalls) instead of global coverage ratios. |
| Operational core (campaign headers/lines, billing, vendor IO, RLS/permissions, client-portal plumbing on quotations) | The Run verb | Mostly right today; it becomes the flywheel's intake rather than a separate module. |

## 6. Evolve (right idea, wrong shape)

| Today | Becomes | How |
|-------|---------|-----|
| **CIP + CampaignFacts + CampaignObject + StrategyDocument** (four SSOTs) | **The Campaign File** — one versioned, sectioned, provenance-carrying object | CIP is the closest ancestor (persisted, brand-scoped, RLS'd, provenance-aware): absorb CampaignFacts into it, fold the CampaignObject's sections in as the File's working document, retire StrategyDocument as a type (its content becomes File sections). Expand-and-contract migration; `campaign_intelligence_profiles` is the natural host table. |
| **Studio** (17 flat cards inside chat) | **Campaign File renderer** in the Room | Section components, structured builders, grounding badges, decision overlays, and proposal export all survive — re-parented from "cards in a chat message" to "views of the File," reorganized into the narrative arc, with overlays becoming approvals on File blocks. |
| **Discovery UI** (8 sub-routes) | **The Roster** (asset management: browse, enrich, import, control center) + in-Room matching | Search/compare/shortlists functionality folds into the Room's Plan verb; the Roster keeps import, enrichment ops, and governance. Standalone search survives as a utility, not the centerpiece. |
| **Ranking stack** (`campaign-relevance-scoring`, thinkway_score ordering) | Retrieval features inside `retrieve_creators` | The boolean criteria scorer is demoted to one feature among several (filters, vector similarity, re-rank). `thinkway_score` ordering is dropped from campaign contexts entirely. |
| **AI workflows engine** (regex matcher, fixed task lists) + **agent runtime** (`features/ai`) | The Campaign Agent loop | Keep the orchestrator's LLM-gateway role (provider abstraction, streaming, tool registry — `runWorkflowTask`'s bones). Retire regex intent matching and fixed task sequences; the File's state machine replaces "workflow status." |
| **Enterprise Discovery gate** (global sufficiency ratios) | Campaign-specific staffing check | "Can this brief be staffed: 3 macro + 8 micro, Arabic, KSA?" computed against the slate requirements; same audit-trail pattern (`discovery_coverage_decisions`) kept. |
| **Quotation workspace** | The Price verb inside the Room | Engine, serials, versioning, promote-master-data all reused; the standalone workspace becomes an ops/finance view rather than the primary journey. |

## 7. Retire (cost without insight)

- **Campaign Director template pipeline** — templated strategy documents, regex cross-review, debate engine, challenge loop, governance meta. The deterministic *rules* inside it (budget sums, client-facing timeline phases) survive as guards; the deliberation theater does not.
- Regex workflow trigger matching; `AGENT_INTENT_MAP`-style fixed routing.
- Dual section vocabularies (9 object sections vs 17 studio sections) and their resolvers.
- Deprecated criteria→filter mappers (`searchStrategyToCreatorFilters`) and display-label criteria round-trips.
- Prose-as-data section updaters (LLM markdown parsed back into sections) — the agent writes structured sections directly.
- Coverage-ratio env-var sprawl, once the staffing check replaces it.

## 8. Getting there without a rewrite (strangler path)

1. **Build the Campaign File** as a superset of CIP (dual-read with CampaignObject); render existing Studio sections from it. Nothing user-visible changes yet.
2. **Stand up the Room** as a new route hosting File + chat; the existing workflow engine still powers generation behind it. The 8 Discovery doors stay open but stop being the primary path.
3. **Swap the brain**: introduce the agent loop behind the same File-write contract and guard suite; A/B against the workflow pipeline on the golden brief set; cut over when it wins; delete the Director pipeline.
4. **Swap the matcher**: embeddings + re-rank + slate optimizer behind the existing search façade, feature-flagged per workspace.
5. **Close the flywheel**: settlement ingestion → DNA economics facet + calibration mart; surface Memory citations in the File.
6. **Consolidate routes** to Room + Roster + ops views; retire dead surfaces.

Each step ships behind the guards and flags that already exist; production data is never migrated destructively (expand-and-contract everywhere); the operational core (campaigns, billing) is untouched until the very end, when it simply gains an automatic data-return duty.

---

## Closing

Stripped to first principles, Thinkway is **priced memory with an agent on top of it**. The four assets you'd keep are precisely the memory (DNA, warehouse), the meaning (campaign intelligence), and the money (commercial engine) — which is to say: the 2026 refounding doesn't discard the company, it discards the *chrome around it*. The Room, the Roster, the Memory, one File, one agent, five verbs — and every campaign that runs makes the next one smarter. That is a product none of the incumbents can copy without first spending three years losing money on MENA campaigns to earn the data.
