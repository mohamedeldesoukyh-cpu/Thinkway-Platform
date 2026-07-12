# Campaign Copilot — Architecture & Capabilities

The Campaign Copilot turns the Studio chat into a persistent **AI Campaign Strategist**. Once a campaign studio exists in a conversation, the chat permanently enters **Campaign Editing Mode**: the campaign is always the context, the user refines it through natural conversation, and every change edits the live Campaign Object while preserving everything else.

Status: implemented and pushed to `claude/thinkway-3` · Owner: Studio/AI · Last updated: July 2026

---

## 1. Design principles

1. **One source of truth.** The Campaign Object is the only document model. The Studio UI, the proposal, and the PDF/PPTX exports are all *derived views*. Edits mutate the object; views re-derive automatically. There is no second store, no parallel slide model.
2. **The AI proposes; deterministic code disposes.** The LLM only emits **structured intents** (via tool-calling) or authored **content** validated against existing schemas. Every mutation runs through deterministic, tested engine code — edits can never be hallucinated.
3. **Never regenerate the whole studio.** Each request edits only the affected section/slate/fact; every other section is preserved byte-for-byte.
4. **Always grounded, always versioned.** Prompts forbid inventing creators, budgets, dates, or metrics not in context. Every applied edit saves a new Campaign Object version and appends a change-log entry.
5. **Explain the reasoning.** Replies read like a strategist's rationale — what changed, *why*, and the grounded downstream effect — not a changelog.

---

## 2. Request lifecycle

```
POST /api/ai/chat
  → resolve conversation + load its Campaign Object (loadCampaignObjectForConversation)
  → ROUTING PRIORITY:
      1. Campaign Editing Mode   ← object exists, no paused workflow, not "new campaign"
      2. Workflow execution      ← create-campaign / resume
      3. General chat            ← fallback orchestrator
  → runStudioCopilot({ campaignObject, message, focus })
      → interpret: LLM tool-call → structured intent (deterministic keyword fallback)
      → execute: deterministic engine mutates ONLY the target
      → reoptimize/rescore where the slate changed (skipped for content edits)
      → persist a new version (saveCampaignObject) + append change-log entry
      → compose a grounded "what + why + effect" reply
  → stream reply; assistant message carries the refreshed campaignObject
  → studio panel + exports re-render from the new object
```

**Campaign Editing Mode ownership** (`app/api/ai/chat/route.ts`): the mode owns follow-up turns until the user explicitly starts a new campaign (`isNewCampaignRequest`) or a create-campaign workflow is paused for missing info. This is why the Copilot never asks "which campaign?" — the active object is the context.

---

## 3. The intent model

The LLM chooses exactly one tool; a deterministic executor runs it. Interpretation lives in `studio-copilot-parse.ts` (tool schema + tool-call parsing + a keyword fallback that keeps the Copilot alive without an API key). Intent types are in `studio-copilot-intents.ts`.

| Intent | Executor edits | Recomputes |
|---|---|---|
| `remove_creators` (tier / name / city / country / below-engagement) | slate | slate + scores |
| `add_creators` (category / tier / location, Discovery-sourced) | slate | slate + scores |
| `replace_creators` (from-tier → to-tier/category, higher-engagement) | slate | slate + scores |
| `update_budget` / `update_timeline` / `update_platforms` / `update_objectives` / `update_audience` / `update_market` | `campaignFacts` (SSOT) + summary cards | slate + scores (re-derived from facts) |
| `author_section` (strategy · executive_summary · creative_concepts · kpis · risks) | one section's content/data | none (content only) |
| `retone_proposal` | strategy + executive summary together | none |
| `restore_version` / `undo_last_change` | replaces current with an earlier version | — |
| `answer_question` | nothing (grounded answer) | — |
| `clarify` | nothing (contextual question) | — |

**Adding an intent** = add the type (`studio-copilot-intents.ts`), the tool + parse (`studio-copilot-parse.ts`), and an executor case (`studio-copilot.ts`). The engine, versioning, and reply composition are shared.

---

## 4. The deterministic engines

### 4a. Slate edits — reuse the Draft Studio engine
`studio-draft.ts` (`stageDraftChange` → `applyStudioDraftChanges`) + `apply-draft-reoptimize.ts` (`reoptimizeCampaignAfterApply`: re-rank against the strategy tier mix, refresh roles, recompute the 8 campaign scores). Copilot slate executors stage changes, apply, re-optimize, and version — the same path the Draft Studio "Apply All Updates" uses.
- `slate-edit-filters.ts` (pure): tier→follower bands, location/engagement removal predicates, slate-exclusion picker.
- `slate-edit-mutations.ts`: Discovery search (`browseUnifiedCreators`) + slate hydration + draft-change builders. Degrade to no-op on error.

### 4b. Facts edits — mutate the SSOT, let views re-derive
`campaign-facts-mutations.ts`: `patchCampaignFacts` updates `meta.campaignFacts` and refreshes the stored summary cards. Budget total, currency, duration, activation waves, and creator mix **re-derive from facts at read time** (`resolveBudgetData`, `buildActivationWaves`, `buildCreatorMixFromFacts`), so the studio and exports update with no extra writes.

### 4c. Content authoring — edit one section, validate the shape
`section-authoring.ts` + `section-authoring-lists.ts` + `section-authoring-types.ts`:
- **Narrative fields:** strategy grounded fields (`strategy.data.groundedFields`) and the executive summary (`presentation.data.executiveSummary`). The LLM rewrites values grounded in the digest; output is validated (JSON shape, non-empty) and patched into that section only.
- **Structured lists:** creative concepts (`strategy.data.creativeConcepts`), KPIs (`performance.content`), risks (`operations.content`) — with **add / replace / improve / remove** operations. A deterministic validator (`is*SectionData`-style guards + per-item checks) gates every item's shape. `resolveListOperation` + `parseOrdinalIndex` map "add another", "replace", "make the second stronger", "remove this" to the right operation and element.
- **Preservation guarantee:** patches spread the sections object and replace only the target key, so every other section is the *same reference* (covered by tests).

---

## 5. Reference resolution ("this section", "the second concept")

Two focus sources, resolved before asking anything:
1. **UI focus** — the studio panel's "Edit target" chips set `studioFocus.sectionId`, which rides on the chat send (`ChatSendOptions` → `ChatRequestBody.studioFocus` → copilot `RunInput.focus`).
2. **Conversational focus** — after an edit, the last authored section is recorded on the change-log entry (`CopilotChangeLogEntry.section`); "expand this section" resolves to it.

Ordinals ("first/second/third") and focus `elementIndex` select the element within a list. The Copilot only asks a **contextual** clarifying question (referencing the real slate/sections) when the reference is genuinely ambiguous — never a generic "which campaign?".

---

## 6. Versioning, history & restore

- Every applied edit calls `saveCampaignObject(..., { persistToDb })` → a new version in the `campaign_objects` versioned store (`CampaignObjectPersistenceService`), and appends a `CopilotChangeLogEntry` (`summary`, `intent`, `section?`, `overallScoreAfter?`).
- **History panel** (`campaign-history-panel.tsx`): the change-log timeline plus a restorable version list (`listCampaignObjectVersionsAction`).
- **Restore** is itself a Copilot intent (`restore_version`) — forward-restore that saves the earlier snapshot as a new current version (history is never rewritten). `undo_last_change` restores the immediately previous version. Both flow through the normal chat path, so the studio re-renders with no extra plumbing.

---

## 7. The two-pane workspace

`intelligence-workspace.tsx`: once a studio exists, the desktop layout splits — **Copilot chat on the left, the live Campaign Studio persistent on the right** (`campaign-studio-panel.tsx`, bound to the latest campaign object via `findLatestStudioMessage`). Chat edits update the panel in place; the chat shows only the change summary ("Updated in the Campaign Studio →"). Smaller screens keep the inline studio. The panel header carries the focus chips (§5) and the history panel (§6).

---

## 8. Change-summary explanations

`buildChangeSummary` / `renderChangeSummary` (`studio-copilot-intents.ts`) compose a strategist's rationale, deterministically:
- **Action** — first-person past tense ("removed the 2 Celebrity creators (Salma Dance, Nour Beats)").
- **Rationale** — `extractRationale` pulls the reason clause from the user's words ("… as the client will handle them" → "because the client will handle them"); omitted when none was given.
- **Effects** — grounded in the *re-optimized* object: `describeDominantTiers` names the tiers the updated slate now leans on; budget/score effects reflect the real recompute.
- **Score** — directional ("held steady at 84/100" / "rose from 80 to 86" / "moved from 84 to 79").

Example: *"I removed the 2 Celebrity creators (Salma Dance, Nour Beats) because the client will handle them. The creator mix was rebalanced toward macro and mid-tier creators, the budget was reallocated across the updated slate, and the campaign score held steady at 84/100."*

---

## 9. File map

```
app/api/ai/chat/route.ts                      Campaign Editing Mode routing
features/ai-workspace/
  types/index.ts                              ChatRequestBody.studioFocus
  hooks/use-ai-chat.ts                        ChatSendOptions.studioFocus → request body
  components/
    intelligence-workspace.tsx                two-pane layout + focus state
    campaign-studio-panel.tsx                 right-pane live studio + focus chips + history
    campaign-studio-panel-utils.ts            findLatestStudioMessage (pure)
    campaign-history-panel.tsx                change history + restore
features/campaign-studio/
  services/copilot/
    studio-copilot.ts                         orchestrator + executors
    studio-copilot-intents.ts                 intent types, context digest, change summary
    studio-copilot-parse.ts                   tool schema + tool-call + keyword fallback
    campaign-facts-mutations.ts               facts-level edits
    slate-edit-filters.ts / slate-edit-mutations.ts   slate edits + Discovery sourcing
    section-authoring.ts / -lists.ts / -types.ts       content authoring
  actions/
    campaign-version-actions.ts               version list (read-only)
    persist-campaign-object-on-message.ts     shared persistence helper
features/campaign-intelligence/
  services/campaign-object-store.ts           saveCampaignObject (versioning)
  services/campaign-object-persistence.ts     versions: list / load / restore
  services/apply-draft-reoptimize.ts          slate re-rank + score recompute
  types/campaign-object.ts                    CopilotChangeLogEntry
```

---

## 10. Testing & validation

- **Unit tests** (node:test via `npx tsx --test`): 46+ across the copilot suites — intent parsing (tool + fallback), facts mutations, slate filters/builders, section-authoring engine including the **"every other section is the same reference"** preservation guarantee, list operations/ordinals, and the change-summary "what + why + effect" rendering.
- **Determinism:** pure logic (parsing, filtering, patching, summary composition) is fully tested and API-key-independent. The LLM authors prose/intent; deterministic code validates and applies.

**Runtime dependencies for live validation:**
- Content authoring and LLM intent interpretation need `OPENAI_API_KEY` (the keyword fallback covers common edits without it).
- Slate sourcing needs Discovery data (`browseUnifiedCreators`).
- Versioning/history/restore need the Supabase-backed `campaign_objects` store.

---

## 11. Deferred (prioritize after end-to-end validation)

- **Deliverables editing** and **competitive benchmarks** — declared in the authoring target vocabulary; not yet wired to executors (benchmarks have a heavier required-field shape; deliverables overlap with facts-editing).
- **Presentation overlay (7d)** — slide-level structural ops (hide slide, split section, add wave, reorder). The proposal stays a derived artifact; when needed, a minimal `presentation.data` overlay respected by the proposal builder keeps the single source of truth intact. Deferred by product decision pending real user workflows.
```
