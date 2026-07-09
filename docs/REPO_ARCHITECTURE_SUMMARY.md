# Thinkway Platform — Architecture Summary

**Scope:** Whole-repo architecture overview with deep dives into Discovery, Studio, the Campaign Intelligence Object, Creator DNA, Enterprise Discovery, AI Workflows, and the Quotation Engine.
**Date:** July 2026 · Analysis only — no code changes.

---

## 1. Platform overview

Thinkway is an enterprise influencer-marketing **operations platform** built on **Next.js App Router + TypeScript + Tailwind/shadcn + Supabase (PostgreSQL/Auth/RLS) + Vercel**, with one standalone Node microservice (`services/discovery-worker`) for crawling/enrichment.

**Canonical hierarchy:** `Group → Client (Legal Entity) → Brand → Campaign Header (TW-YYYY-NNNN) → Campaign Line (-A/-B/…)`. Brand is the campaign lookup key; commercial attributes (category, VR%, direct/agency, currency) are normalized on brands and inherited by campaign headers via DB triggers.

### Layering

| Layer | Location | Role |
|-------|----------|------|
| Routes | `app/(dashboard)`, `app/(client-portal)`, `app/(creator-portal)`, `app/api` | Thin pages/route handlers; workspaces at `/campaigns/[id]`, `/groups/[id]`, `/discovery/*`, `/ai/*` |
| Feature modules | `features/*` (~45 modules) | Vertical slices: `actions` (server actions) · `components` · `hooks` · `services` · `types`, plus `validate-*.ts` runtime validation scripts per release gate (ERS-1…ERS-4, IS-1…IS-3) |
| Domain libraries | `lib/*` | Pure/shared logic: commercial math, FX, analytics fact loaders, discovery orchestration, entity resolution, Supabase clients |
| Persistence | `supabase/migrations` (300+ SQL files) | Operational tables + RLS + triggers; separate `intelligence.*` warehouse schema |
| Worker | `services/discovery-worker` | BullMQ workers over Redis: Playwright crawlers, enrichment, schedulers, anti-bot |

### Two "intelligence" systems (disambiguation)

1. **Historical Intelligence Warehouse** (`lib/intelligence`, `scripts/intelligence-etl`, `/intelligence` routes) — read-only ETL of 2023–2026 Excel history into an isolated `intelligence` schema (raw → intermediate → marts) for pricing/benchmarking/margin analytics. Never writes back to operational tables.
2. **Campaign/Creator Intelligence** (the AI product layer, below) — `features/campaign-intelligence*`, `features/creator-dna`, `features/ai*`, `features/campaign-director`, `lib/intelligence-persistence`. This is what Discovery, Studio, and the AI Workspace run on.

---

## 2. Discovery

**Where:** `features/discovery` (UI + actions), `lib/discovery` (orchestration), `lib/creators` (unified browse/coverage), `services/discovery-worker` (crawling), routes under `app/(dashboard)/discovery/{search, shortlists, quotations, intelligence, compare, import, campaign-match}`.

**What it is:** a hybrid public-signal influencer discovery engine that works without paid social APIs.

```
Next.js /discovery UI ──enqueue──► Redis (BullMQ) ──► discovery-worker (Playwright crawl + OpenAI classify)
        │ read/search                                        │
        ▼                                                    ▼
Supabase: discovered_profiles · profile_metrics · profile_ai_scores ·
          discovery_sources · profile_relationships · discovery_shortlists
```

- **Discovery methods:** hashtag, competitor/mentions graph, location (UAE/KSA/Egypt), TikTok trend participation.
- **Enrichment pipeline stages:** `discovered → basic_enriched → metrics_enriched → ai_scored → verified`; extracts followers, engagement, bio, email-in-bio, posting frequency; authenticity heuristics (follower/engagement ratio, spikes, repetitive comments); optional OpenAI classification (niche, luxury level, brand fit).
- **Tiered auto-refresh:** 500K+ daily · 50–500K weekly · <50K monthly (worker schedulers).
- **Search:** Postgres `tsvector` over `discovered_profiles`, plus a **unified creator browse** (`lib/creators/unified-browse`) that merges internal vendor-master influencers with discovered profiles (dedupe in `lib/discovery/creator-result-dedupe.ts`).
- **Promotion path:** discovered profile → shortlist → promote to vendor master (`lib/discovery/promote-profile.ts`); `discovered_profiles.influencer_id` links promoted vendors.
- **Shortlists** (`features/discovery/shortlists`): serials `SL-YYYY-NNNN`, per-item commercial fields, move/bulk policies, and the seed for quotations (§8).
- **Permissions:** `discovery.read` / `discovery.write` / `discovery.admin`, enforced UI + RLS.
- **Import Center** (`features/discovery-import`, `/discovery/import`): PDF/dataset ingestion of external creator lists.

---

## 3. Studio (Campaign Studio)

**Where:** `features/campaign-studio`, hosted by `features/campaign-decision-workspace/components/campaign-studio-host.tsx`, rendered inside the AI Workspace chat thread (`features/ai-workspace/components/chat-thread.tsx`) at `/ai/[conversationId]`.

**What it is:** the presentation/decision surface for AI-generated campaign plans. When a workflow message carries studio metadata, the chat renders a live, progressively-hydrating **Campaign Studio** instead of markdown.

- **17 sections** (`CampaignStudioSectionId`): campaign summary, executive strategy, creator discovery, creator recommendations, budget planner, timeline, KPI forecast, risk analysis, creative concepts, content plan, creator mix, why-AI, industry benchmark, success probability, opportunity finder, executive summary, presentation status.
- **Data source:** `CampaignStudioState` embeds the canonical **CampaignObject** (§4); `services/section-data-resolver.ts` + `campaign-intelligence/services/studio-renderer.ts` / `studio-section-data-builders.ts` map object sections to studio cards. Section cards show specialist attribution and **grounding badges** (`sections/shared/grounding-badge.tsx`, `services/grounding-types.ts`) so every claim traces to evidence.
- **Two modes:** *Presentation* vs *Decision*. Decision mode adds overlays (`decision-overlays/budget-decision-overlay.tsx`, `vendor-decision-overlay.tsx`) backed by `features/campaign-decision-engine` (pure simulators: budget, creator, KPI, scenario, decision scoring) and `campaign-decision-workspace` (approve/reject/shortlist creators, budget approval).
- **Creator hydration:** `hooks/use-creator-hydration.ts` + `creator-hydration-mapper.ts` pull real Creator DNA (§5) into recommendation cards — creators are never LLM-invented (enforced by grounding validators in `features/ai-workflows/validate-creator-grounding.ts`).
- **Supporting services:** budget allocation with 100% normalization, creator fee estimator, timeline duration rules, industry/presentation intelligence, `export/campaign-proposal-document.ts` for client-facing proposal export.
- **Context enrichment:** `services/campaign-director-context.ts` consults `features/knowledge-engine` (entity resolver, relationship graph, workspace resolver) before workflow matching, so prompts are grounded in real brands/clients/campaigns.

---

## 4. Campaign Intelligence Object

Two tightly-coupled artifacts form the campaign SSOT; the term covers both:

### 4a. CampaignObject — the 9-section live document

`features/campaign-intelligence/types/campaign-object.ts`. Sections: **summary, audience, strategy, creators, budget, timeline, performance, presentation, operations** — each `{ content, data, status, updatedBy (specialist|director), updatedAt }`.

- Written only through the **Campaign Director pipeline** (`features/campaign-director`, doc: `docs/intelligence/CAMPAIGN_DIRECTOR_ARCHITECTURE.md`):
  1. Director writes a **Campaign Strategy Document** (SSOT) from the brief.
  2. Specialists (Strategy, Finance, Creator Intelligence, Creative, Media Planner, Performance, Risk, Presentation) receive *strategy + domain instructions only* — never the raw user prompt alone.
  3. **Cross-review** (finance↔creators, risk↔creators…), **conflict detection**, and a **challenge loop** (max 3 revision rounds).
  4. **Approval gate:** sections are applied only when `unresolvedConflictCount === 0`.
- `meta` carries pipeline state: specialist progress, **CampaignFacts** (structured facts SSOT from `features/campaign-director/facts`), director pipeline/debate metadata (IS-3 debate engine), and governance reports (`features/campaign-governance`, Release 1.1.7) — metadata only, never rendered as sections.
- **Persistence:** `campaign-object-persistence.ts` / `campaign-object-store.ts` → `campaign_objects` (migrations `20260712010000`, version-race fix `20260712020000`), keyed to conversation/workflow with optimistic versioning.
- Budget rules (allocations sum to exactly 100%, influencer-marketing model) and timeline rules (client-facing phases only) are enforced by director rule modules, not prompt luck.

### 4b. Campaign Intelligence Profile (CIP) — brand-scoped persistent SSOT

`features/campaign-intelligence-profile`, table `campaign_intelligence_profiles` (migrations `20260713100000`, `20260714100000` "Campaign Intelligence Object").

- `CampaignIntelligenceProfile = CampaignFacts +` campaign name/market/products/objectives, audience detail, creator categories/niches, deliverables, tone, brand-safety level, market tier, mandatory/preferred/negative requirements, expected creator count.
- **Pipeline:** brief upload → extract (`extract-profile-llm.ts`, structured brief parser) → normalize → validate → **`validatedIntelligence`** (the only field Discovery, Studio, and UI may read) → persist. Field provenance and extraction issues are stored for review.
- Linked both ways to campaigns: `campaign_intelligence_profiles.campaign_header_id` and `campaign_headers.campaign_intelligence_profile_id`; brand-scoped RLS via `can_access_campaign_intelligence_profile()`.
- Drives Discovery: `strategy-to-filters.ts` / `search-creators-from-profile.ts` convert the profile into weighted search criteria (`CampaignSearchCriterion`) for AI search; managed in the UI at `/discovery/intelligence` (+ library).

**Relationship:** brief → **CIP** (persistent, brand-scoped) → feeds CampaignFacts/context → Director pipeline builds the **CampaignObject** (per-conversation working document) → Studio renders it → decisions/exports flow to real campaign headers/lines.

---

## 5. Creator DNA

**Where:** `features/creator-dna` (ERS-4), tables `creator_dna` (+ staging, versions; migrations `20260704120000` onward), fed by `lib/intelligence-persistence` (IPL) and `lib/creator-enrichment`.

**What it is:** the canonical creator intelligence document, keyed by `influencers.id` (staging variant keyed by `discovered_profile_id` before promotion).

- **Document shape** (`CreatorDNADocument`): identity, platforms, metrics, audience (incl. demographics that must come from a real provider — "never Apify-invented"), contact, content (recent publications), commercial (rates, deliverables, exclusivity, competitor history), brand safety (fake followers, political risk…), historical performance, AI scores (Thinkway score, brand fit, authenticity), and meta.
- **Field envelopes:** every field is `{ value, confidence, source, updatedAt, history[] }`. Source priority: **manual (5) > campaign (4) > oauth (3) > ipl (2) > ai_infer (1)**; merge tiers **verified > imported > inferred > empty**. The merge engine (`dna-merge-engine.ts`, conflict resolver) only overwrites lower-priority values, and history is append-only.
- **Lifecycle:** `IMPORTED → BASELINE → ENRICHED → ACTIVE → STRATEGIC` (+ `ARCHIVED`) — advances forward only; drives refresh cadence and prioritization (`dna-lifecycle.ts`).
- **Completeness engine** (`dna-completeness-engine.ts`): scores 8 dimensions, lists missing/verification-required fields; coverage reporting for the whole database.
- **Ingest paths (writers):** baseline populator (vendor master import), Apify→DNA mapper via **IPL snapshots** (`writers/ipl-snapshot-mapper.ts`), campaign learning, manual edits — each versioned in `creator_dna_versions` with change reason and lineage events.
- **IPL (Intelligence Persistence Layer)** — `lib/intelligence-persistence` (Sprint 8.5): cache-first provider fetch (`fetchProfileWithIpl`), immutable raw snapshot persisted **before** normalization, provider-agnostic normalized snapshots, `ipl_provider_runs` audit (duration/cost/errors), TTL refresh policies (7/14/30-day by follower tier), and offline `reprocessSnapshot` for AI re-classification without new external calls.
- **Consumers:** Studio creator hydration, Discovery search/rank, quotation shortlist seeds, AI workflow creator grounding.

---

## 6. Enterprise Discovery

**Where:** `lib/discovery/{enterprise-discovery-gate, coverage-backfill-orchestrator, dataset-acquisition-*, intelligence-sufficiency, cip-acquisition-cooldown, control-center}`, `lib/creators/discovery-coverage*`; ops doc `docs/release/1.2/DISCOVERY_CONTROL_CENTER.md`.

**What it is:** the automated *database-first, acquire-on-gap* layer that keeps the creator database sufficient for any search — with governance and cost controls.

**Flow** (`browseUnifiedCreatorsWithCoverageBackfill`):

1. Serve the search **from the database first** (unified browse across internal + discovered creators).
2. On page 1 with backfill intent, evaluate **coverage** (`evaluateDiscoveryCoverage`) and optionally **intelligence sufficiency** (`evaluateIntelligenceSufficiency` — sufficiency score/level, intelligence gaps, acquisition hints).
3. Run the **enterprise gate** (`evaluateEnterpriseDiscoveryBackfillNeed`): creator count is the primary signal, then intelligence sufficiency (when the dataset-acquisition feature flag is on) or coverage score vs threshold. Reasons: `low_creator_count | intelligence_insufficient | coverage_below_threshold | sufficient`.
4. If backfill is needed, **enqueue asynchronous enterprise acquisition** (BullMQ `EnterpriseAcquisitionJobData`: platform, job payload, country, category tags, intelligence hints) — the request returns immediately; acquisition runs in the background (Apify dataset → import pipeline → Creator DNA) and aborts if the client search session ends.
5. Every decision is audited in `discovery_coverage_decisions`.

**Guards & governance:**

- **CIP acquisition cooldown** (`cip-acquisition-cooldown.ts`) prevents re-triggering acquisition for the same campaign profile repeatedly.
- **Discovery Control Center** (Release 1.2; `/settings/discovery-engine`, `/settings/discovery-diagnostics`; table `discovery_control_settings`): operational control plane for source selection (DB-only / Apify-live-only / hybrid), Apify gating and usage tracking (`discovery_apify_usage`), enrichment triggers, DNA policy flags, freshness signals, and cost protection. All discovery paths (browse, progressive search, backfill, enrichment enqueue) consult `discovery-control-policy.ts`.
- **Apify import pipeline** (`apify-import-pipeline.ts`, transaction, cleanup, profile backfill) normalizes acquired datasets into `discovered_profiles` + DNA staging, with dedupe and campaign-relevance/fit re-ranking (`campaign-fit-rerank.ts`, `rank-browse-for-campaign.ts`).

---

## 7. AI Workflows

**Where:** `features/ai-workflows` (definitions + engine), `features/ai` (agent runtime), `features/ai-workspace` (chat surface at `/ai`), `features/ai-analyst`.

**Agent runtime** (`features/ai`): an `AiOrchestrator` composed of an **agent registry** (general, planner, strategist, scout, analyst), an **agent router**, a **tool registry** (read-only vs mutating tools, e.g. `searchCreators`), context builder, conversation manager, memory store, and a pluggable LLM provider (streaming OpenAI provider lives in `ai-workspace/services`).

**Workflow engine** (`features/ai-workflows`):

- **Six declarative workflow definitions:** `create-campaign`, `find-creators`, `analyze-campaign`, `generate-brief`, `build-shortlist`, `campaign-health-check`. Each is a typed `WorkflowDefinition` with regex trigger patterns + confidence threshold and an ordered task list; each task declares agent, intent, allowed tools, `readonly` flag, `requiredState`, and a `buildPrompt(ctx)`.
- **Engine:** `workflow-matcher` (intent match) → `workflow-engine.executeWorkflow / resumeWorkflow` → `task-runner` per task; `continuation.ts` (auto-continue/pause decisions), `disambiguation.ts`, and `campaign-resolver.ts` (resolving "my Ramadan campaign" to a real header for campaign-required workflows).
- **Director integration:** `create-campaign` initializes the Director pipeline state on start and runs the full pipeline on completion (§4a), so specialist prompts are strategy-grounded and sections are approval-gated.
- **Output:** `dashboard/` formats live workflow progress panels; `formatters/executive-report-generator.ts` renders the find-creators executive report; `ai-workspace/services/workflow-adapter.ts` converts workflow metadata to chat messages that host Campaign Studio.
- **Trust rails:** a battery of `validate-*.ts` gates (creator grounding, creator integrity, search parity, live parity ERS-1, search intelligence ERS-2, executive report structure, creator trace) enforce that creators shown to users exist in the database and match what search returned.

---

## 8. Quotation Engine

**Where:** pure math in `lib/commercial` (canonical `quotation-engine.ts`; `features/quotations/quotation-engine.ts` is a deprecated re-export), feature slice in `features/quotations`, UI at `/discovery/quotations`; docs: `docs/QUOTATION_COMMERCIAL_LIFECYCLE.md`, `docs/QUOTATION_ENTERPRISE_AUDIT.md`.

**Commercial math (pure, unit-tested, DB-free):**

- `computeCommercials` accepts one of three input modes — cost + GP%, cost + revenue, or cost + GP value — and normalizes to the full set (cost, revenue, gp_pct, gp_value) with validity warnings; `computeAgencyFee` layers AF% on top.
- `normalizeCommercialLine` produces the canonical persisted shape: original-currency commercials **plus EGP-converted values** (reporting currency = EGP) using a pre-resolved FX rate; `computeQuotationTotals` aggregates header totals. The *same* engine powers shortlist Commercial tabs and quotation items, so the math is identical everywhere.
- **FX reuse:** no new FX system — `md_currencies` / `md_exchange_rates` + `resolve_effective_exchange_rate()` RPC wrapped by `lib/commercial/fx-server.ts`.

**Data model & lifecycle:**

- `quotations` (serial `QT-YYYY-NNNN`, versions `-Vn` via `parent_quotation_id`, status enum, EGP totals, terms/signature/client-portal readiness columns) and `quotation_items` (snapshot of creator identity + commercials, `source_shortlist_item_id` link).
- **Bidirectional linkage:** quotation ↔ shortlist ↔ campaign header, with `quotation_version_history` audit; shortlist items seed quotation items (`shortlist-seeds.ts`) and campaign influencers trace back to shortlist items.
- **Temporary vs master parties:** quotations may use quotation-scoped client/brand names; they never auto-create master records — `promote-master-data.ts` (+ wizard) promotes them explicitly, preserving the Group → Legal Entity → Brand hierarchy.
- **Policy modules:** validity windows (`quotation-validity.ts`), default terms, GP-health checks (`quotation-gp-health.ts`), duplicate search, list policies, row math, serials — each with colocated tests.
- Serials are generated by DB trigger (`generate_quotation_serial` wrapping `next_document_number`), never reused, reset yearly; RLS mirrors discovery shortlist patterns.

---

## 9. How it all connects (end-to-end)

```
Brief upload ──► Campaign Intelligence Profile (extract → normalize → validate → validatedIntelligence)
                     │
                     ├──► Discovery AI search (strategy-to-filters, weighted criteria)
                     │        │  database-first browse
                     │        ▼
                     │  Enterprise Discovery gate ──insufficient──► BullMQ acquisition
                     │        │                                        (Apify dataset → import → Creator DNA)
                     │        ▼
                     │  Creators (unified browse, DNA-hydrated, grounded)
                     │
                     └──► AI Workflow (create-campaign) ──► Campaign Director pipeline
                              (strategy SSOT → specialists → cross-review → conflict-free approval)
                                        │
                                        ▼
                              CampaignObject (9 sections, persisted, versioned)
                                        │
                                        ▼
                              Campaign Studio (17 sections, presentation/decision modes)
                                        │ approve creators & budget
                                        ▼
        Shortlist (SL-…) ──► Quotation (QT-…, EGP engine, versions) ──► Campaign Header/Lines (TW-…)
                                                                              └► Billing / Vendor IO / Finance
```

Cross-cutting: Supabase RLS + permission slugs at every layer; append-only provenance (DNA field history, IPL snapshots, coverage decision audit, quotation version history); pure engines with colocated tests for anything financial; validation gate scripts (`validate-*.ts`) per release for the AI surface.
