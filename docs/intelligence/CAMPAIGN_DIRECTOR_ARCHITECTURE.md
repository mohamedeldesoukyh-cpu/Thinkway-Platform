# Campaign Director Intelligence Architecture

> **Scope:** Intelligence layer only — no UI changes, no Decision Workspace, no Discovery/Creator DNA modifications.

Generated: 2026-07-04

## Executive Summary

Thinkway AI campaign generation now follows a **Campaign Director** model: one strategic brain writes a single source-of-truth (SSOT) document, dispatches domain-scoped work to specialists, runs cross-review and challenge loops, and only approves output when **zero unresolved conflicts** remain.

## Current vs Target Architecture

### Before (Independent Section Generation)

```
User Prompt
  ↓ (repeated in every task buildPrompt)
Workflow Tasks (sequential, isolated)
  analyze-request → build-strategy → estimate-budget → search-creators → ...
  ↓ (each task sees raw userMessage)
Section Updaters (per-task parsing)
  ↓
CampaignObject sections (stitched LLM outputs)
```

**Problems identified:**

| Area | Previous behavior |
|------|-------------------|
| Strategy | Each specialist received raw user prompt; no SSOT |
| Budget | Parsed independently; percents not guaranteed 100% |
| Timeline | Included internal agency phases (outreach, discovery, kickoff) |
| Quality | No cross-specialist review or contradiction detection |
| Approval | Workflow completed regardless of section conflicts |
| `CampaignDirector` (campaign-intelligence) | Event coordinator only — routes task outputs to sections |

### After (Campaign Director Pipeline)

```
Campaign Brief
  ↓
Campaign Director — writeStrategyDocumentFromBrief() [SSOT]
  ↓
Campaign Strategy Document (stored in workflow state.data.campaignStrategyDocument)
  ↓
Specialists (prompts via buildDirectorTaskPrompt — strategy + domain ONLY)
  ↓
Cross Review (runCrossReview — finance↔creators, risk↔creators, etc.)
  ↓
Director Challenge Loop (detectConflicts → revise → re-check, max 3 rounds)
  ↓
Approval Gate (zero unresolved conflicts required)
  ↓
Director-Approved Sections → CampaignObject
```

## Module Layout

```
features/campaign-director/
├── types/pipeline.ts          # SSOT types
├── services/
│   ├── campaign-director.ts   # Orchestrator: runCampaignDirectorPipeline()
│   ├── strategy-document.ts   # Director writes SSOT from brief
│   ├── specialist-dispatch.ts # Strategy + domain → specialist outputs
│   ├── cross-review-engine.ts # Inter-specialist review rules
│   ├── director-challenge-loop.ts
│   ├── conflict-detector.ts
│   ├── approval-gate.ts
│   ├── budget-rules.ts        # 100% influencer budget, optional categories
│   └── timeline-rules.ts      # Client-facing phases only
└── integrations/
    ├── workflow-integration.ts
    └── section-builder-integration.ts
```

## Core Types

| Type | Purpose |
|------|---------|
| `CampaignStrategyDocument` | SSOT — understanding + narrative + pillars + tier strategy |
| `SpecialistOutput` | `what` + `why` + `evidence` per specialist domain |
| `CrossReviewFinding` | Reviewer → target issue with required revision |
| `DirectorChallenge` | Conflict type, affected sections, resolution status |
| `ApprovalGate` | `approved` only when `unresolvedConflictCount === 0` |

## Specialist Domains

| Specialist | Workflow Tasks | Sections |
|------------|----------------|----------|
| Strategy | analyze-request, build-strategy | strategy, summary, audience |
| Finance | estimate-budget | budget, operations |
| Creator Intelligence | search-creators, build-shortlist | creators |
| Creative | generate-brief | summary |
| Media Planner | generate-timeline | timeline |
| Performance | (derived from strategy KPIs) | performance |
| Risk | (derived from strategy constraints) | operations |
| Presentation | prepare-approval | presentation |

## Integration Points

### 1. Workflow Engine (`features/ai-workflows/engine/workflow-engine.ts`)

- **On start** (`create-campaign`): `initializeDirectorPipelineState()` → injects `campaignStrategyDocument` into `state.data`
- **On complete**: `enrichWorkflowStateWithDirectorPipeline()` → runs full pipeline, stores `state.data.directorPipeline`

### 2. Workflow Definition (`features/ai-workflows/definitions/create-campaign.ts`)

- All `buildPrompt` functions use `directorPrompt()` → `buildDirectorTaskPrompt(strategy, domain, instruction)`
- Specialists never receive raw user prompt alone when strategy document exists

### 3. Section Updaters (`features/campaign-intelligence/services/section-updaters.ts`)

- Budget/timeline tasks apply `applyDirectorBudgetRules()` / `applyDirectorTimelineRules()`
- When `directorPipeline.approvalGate.approved`, `applyDirectorPipelineToCampaignObject()` overwrites sections with approved content + rationale

### 4. Existing CampaignDirector Class (campaign-intelligence)

**Preserved** — still coordinates workflow events and persistence. Intelligence pipeline runs upstream and feeds approved outputs via `syncFromWorkflowState()`.

### 5. Campaign Studio Context (`features/campaign-studio/services/campaign-director-context.ts`)

**Preserved** — knowledge-engine enrichment before workflow match. Complements (does not replace) intelligence pipeline.

## Intelligence Rules

### Budget

- Influencer marketing model — not media buying
- Default: creator fees include production
- Optional categories (Production, Usage Rights, Paid Amplification, Events, Travel, Celebrity Management) only when brief requires
- Allocations normalized to **exactly 100%**

### Timeline

- Client-facing only: Campaign Start → Content Production → Publishing Window → Optimization → Campaign End → Reporting
- Tier progression (Mega → Macro → Micro → Nano) with per-week rationale
- **Excluded:** brief approval, vendor discovery, meetings, internal planning, outreach

## Migration Path for Existing Workflows

| Workflow | Migration |
|----------|-------------|
| `create-campaign` | **Fully integrated** — Director pipeline active |
| `find-creators` | Unchanged (Discovery architecture not modified) |
| `build-shortlist` | Unchanged |
| `generate-brief` | Unchanged |
| `analyze-campaign` | Future: add strategy injection when campaign analysis needs SSOT |
| `campaign-health-check` | Unchanged |

**Backward compatibility:**

- Workflows without `campaignStrategyDocument` in state fall back to previous `buildPrompt` behavior (directorPrompt returns task instruction only)
- Existing `CampaignObject` records without `meta.directorPipeline` remain valid
- Campaign-intelligence `CampaignDirector` class name unchanged

## Validation

```bash
node scripts/validate-campaign-director.mjs
```

Fixtures: BabyJoy, Coca-Cola — verifies strategy doc, why fields, cross-review, conflict resolution, budget 100%, client timeline.

## Related Files (Not Modified)

- Decision Workspace / CDI
- Creator DNA (`features/creator-dna/`)
- Discovery architecture (`features/ai-workflows/definitions/find-creators.ts`, discovery engine)
- UI components
