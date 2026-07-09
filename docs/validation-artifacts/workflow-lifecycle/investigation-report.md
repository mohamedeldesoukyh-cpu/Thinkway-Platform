# P0 Workflow Lifecycle Investigation — BabyJoy Create Campaign

**Date:** 2026-07-03  
**Trigger:** `Launch BabyJoy Premium Diapers in Egypt...` (create-campaign workflow)

## Failing stage

**Result aggregation** — `aggregateWorkflowResults()` in `features/ai-workflows/dashboard/result-aggregator.ts`

## Stage table

| Stage | Started | Completed | Notes |
|-------|---------|-----------|-------|
| Workflow starts | ✅ | ✅ | Server logs confirm both lines |
| Analyze | ✅ | ✅ | `analyze-request` task |
| Strategy | ✅ | ✅ | `build-strategy` task |
| Scout | ✅ | ✅ | `search-creators` task |
| Planner | ❓ | ❓ | `generate-timeline` — not reached before failure in fast-fail runs |
| Analyst | ✅ | ✅ | `estimate-budget` task |
| **Result aggregation** | **✅** | **❌** | **RangeError: Maximum call stack size exceeded** |
| Message persistence | ❌ | ❌ | Never reached (`appendMessage` not logged) |
| SSE "done" | ❌ | ❌ | Never sent; client `doneReceived: false` |
| Conversation reload | ✅ | ✅ | Client-only after error; only 1 message (user) |
| Chat render | ✅ | ✅ | Client simulated path only |

## Log snippet (last started without completed)

```
[workflow-lifecycle] Scout completed
[workflow-lifecycle] Result aggregation started
[workflow-lifecycle] Result aggregation RangeError stack: RangeError: Maximum call stack size exceeded
```

Earlier run (STEP-numbered instrumentation, same failure):

```
STEP 5 START
STEP 7 START
 POST /api/ai/chat 200 in 61s
STEP 5 END
(no STEP 7 END)
(no STEP 8 START — message persistence)
```

Client SSE error payload: `"Maximum call stack size exceeded"`

## Files instrumented (logging only)

| File | Stages logged |
|------|----------------|
| `features/ai-workflows/engine/workflow-engine.ts` | Workflow starts, Analyze, Strategy, Scout, Planner, Analyst |
| `features/ai-workflows/dashboard/result-aggregator.ts` | Result aggregation (+ RangeError stack capture) |
| `app/api/ai/chat/route.ts` | Message persistence, SSE "done" |
| `features/ai-workspace/hooks/use-ai-chat.ts` | SSE "done" (client receive) |
| `features/ai-workspace/components/intelligence-workspace.tsx` | Conversation reload |
| `features/ai-workspace/components/chat-thread.tsx` | Chat render |
| `scripts/workflow-lifecycle-verify.mjs` | Verification harness (new) |

## Recommendation (do not implement yet)

1. **Root-cause `aggregateCreateCampaignResults`** — the stack overflow occurs inside result aggregation after all workflow tasks complete. Likely infinite recursion in:
   - `extractTaskContent` / `preferGroundedTaskContent` / `extractStructuredText`
   - `mergeSectionContent` (circular `includes` checks on large nested strings)
   - `formatToolOutput` traversing circular `structured` / `toolOutputs` references from scout/strategist task results

2. **Bisect within aggregation** — add temporary sub-stage logs inside `aggregateCreateCampaignResults` loop per `CREATE_CAMPAIGN_SECTIONS` mapping to identify which section (strategy, budget, timeline, recommended-creators, brief, approval) triggers recursion.

3. **Defensive depth limits** — when fixing, add cycle detection or max-depth guards in `extractStructuredText` / `formatToolOutput` rather than patching render paths (error is server-side before persistence).

4. **Downstream stages are symptoms** — Message persistence, SSE done, and full conversation reload never run because the API handler catches the RangeError and emits `error` instead of `done`.
