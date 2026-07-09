# Message State Replacement Investigation — BabyJoy Create Campaign

**Date:** 2026-07-03  
**Goal:** Identify first `setMessages` call that drops assistant workflow content (2 → 1).

## Instrumentation added

| File | What was instrumented |
|------|------------------------|
| `features/ai-workspace/debug/message-state-logger.ts` | `createLoggedSetMessages`, `logMessageStateEvent`, regression warning on `before >= 2 && after === 1` |
| `features/ai-workspace/components/intelligence-workspace.tsx` | All `setMessages` call sites, `loadConversation`, `conversationId` effect, `handleSend`, `handleConversationCreated`, `handleSelectConversation` |
| `features/ai-workspace/hooks/use-ai-chat.ts` | SSE `done` and `error` handlers |
| `scripts/investigate-message-state.mjs` | Puppeteer capture harness |

## BabyJoy timeline (new chat, no page reload)

Captured from Puppeteer run on `http://localhost:3000/ai`:

```
1. handleSend optimistic user message
2. setMessages before:0 after:1 caller:handleSend:optimisticUser
3. handleConversationCreated { id: "..." }
4. conversationId effect skipped (streaming)
5. SSE done event { workflow: true, messageId: "..." }
6. SSE done completed { workflowMetadata: "create-campaign" }
7. handleSend onWorkflowComplete { workflowId: "create-campaign" }
8. handleSend create-campaign reload path
9. loadConversation called { force: true }
10. loadConversation skipped (streaming)   ← CRITICAL
11. handleSend updating conversationId
(stream ends — no further setMessages until remount/reload)
```

### Log snippet (offending skip — no replacement occurs)

```
[message-state] handleSend create-campaign reload path {"conversationId":"09f62bbb-7dd2-4dbe-8bd4-ae79c85de96f"}
[message-state] loadConversation called {"id":"09f62bbb-7dd2-4dbe-8bd4-ae79c85de96f","force":true}
[message-state] loadConversation skipped (streaming) {"id":"09f62bbb-7dd2-4dbe-8bd4-ae79c85de96f"}
```

## Root cause (first state loss in create-campaign flow)

**Function:** `loadConversation` in `intelligence-workspace.tsx`  
**Expected call:** `setMessages(fetched, "loadConversation")` after create-campaign workflow completes  
**Actual:** Guard `if (isStreamingRef.current) return` skips reload because `isStreamingRef` is stale:

- `sendMessage()` sets `isStreaming = false` synchronously before returning
- `isStreamingRef.current` is updated in a `useEffect`, which has **not run yet** when `await loadConversation(...)` executes
- Reload is skipped; `handleSend` create-campaign branch never calls `handleSend:mergeResult`
- Messages remain at **1 optimistic user** with no assistant metadata
- Campaign Studio (rendered from `streamingContent` / `workflowProgress`) disappears when streaming ends

**There is no literal `setMessages` 2→1 in the success path without remount** — the UI goes from “user bubble + streaming workflow” to “user bubble only” without a second `setMessages` call.

## When literal 2→1 does occur

The **only wholesale replace** of the messages array is:

```typescript
setMessages(fetched, "loadConversation");
```

Literal `before: 2, after: 1` happens when:

1. Local `messages` has 2+ entries (e.g. prior turn loaded, or `handleSend:mergeResult` on non-create-campaign path), **and**
2. `loadConversation` fetch returns `fetchedCount: 1` (assistant not persisted — see `docs/validation-artifacts/workflow-lifecycle/investigation-report.md` stack-overflow / persistence failure scenario)

On page reload after successful BabyJoy (API had 2 messages):

```
loadConversation replacing messages { fetchedCount: 2, fetchedRoles: ["user","assistant"] }
setMessages before:0 after:2 caller:loadConversation
```

## Recommendation (do not implement yet)

1. **Fix stale streaming guard:** After `await sendMessage()`, use `isStreaming` state directly or set `isStreamingRef.current = false` synchronously before calling `loadConversation` in the create-campaign path.
2. **Or merge then reload:** Call `handleSend:mergeResult` with SSE result first, then optionally refresh from API in background (avoid blind replace).
3. **Re-run `conversationId` effect when streaming ends:** Add `isStreaming` to the effect deps so skipped reloads retry when `isStreamingRef` becomes false.
4. **Persistence failures:** Fix server-side aggregation so assistant message is always persisted before SSE `done`; otherwise `loadConversation` will replace with user-only API data (literal 2→1).

Full capture: `docs/validation-artifacts/message-state-investigation/message-state-report.json`
