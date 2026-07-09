# Campaign Persistence Report — Phase 0.3

**Release:** 1.0 · **Phase:** 0.3 Campaign Persistence  
**Date:** 2026-07-04  
**Status:** Implemented (pending migration apply + runtime verification)

## Summary

Campaign Studio `CampaignObject` state is now durable and versioned in PostgreSQL, linked to AI conversations with monotonic version history, lifecycle states, autosave after completed workflow tasks, restore on conversation open, audit logging, and export of approved snapshots.

## Database

| Object | Purpose |
|--------|---------|
| `campaign_object_lifecycle_status` enum | `draft`, `in_review`, `approved`, `archived`, `published` |
| `campaign_objects` | Head record per conversation (unique `conversation_id`) |
| `campaign_object_versions` | Immutable JSONB snapshots with monotonic `version` |

**Migration:** `supabase/migrations/20260712010000_campaign_object_persistence.sql`

**RLS:** Scoped via `ai_conversations.created_by = auth.uid()` plus existing `can_read_ai_conversations` / `can_write_ai_conversations` helpers.

**Versioning triggers:**
- `campaign_object_versions_assign_version_trg` — auto-increments version per object
- `campaign_objects_bump_version_trg` — updates head `current_version` on insert

## Services

| Module | Role |
|--------|------|
| `CampaignObjectPersistenceService` | saveVersion, loadLatest, loadVersion, listVersions, restore, lifecycle |
| `campaign-object-store` | Memory cache + DB autosave hook |
| `campaign-lifecycle` | Transition rules + permission checks |
| `campaign-export` | `getApprovedSnapshot()` for export routes |
| `conversation-campaign-hydration` | Restore on conversation GET |

## Autosave

- Hook at **store layer** (`saveCampaignObject`) — no workflow engine changes
- Triggered from `CampaignDirector.persist()` when:
  - Workflow task completes (`completed` / `awaiting_approval`)
  - Workflow completes (`workflow_complete`)
- `workflow-adapter` passes `userId`, `supabase`, and `campaignHeaderId` from `/api/ai/chat`

## Restore

1. `loadCampaignObjectForConversation()` tries DB latest version
2. Falls back to `contextSnapshot.campaignObject` (backward compatible)
3. Conversation GET (`/api/ai/conversations/[id]`) hydrates restored object into response

## API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/ai/campaign-objects/[id]/versions` | GET | List version metadata |
| `/api/ai/campaign-objects/[id]/versions/[version]` | GET | Load specific version |
| `/api/ai/campaign-objects/[id]/export` | GET | Export approved snapshot |
| `/api/ai/campaign-objects/[id]/lifecycle` | PATCH | Lifecycle transition |

## Audit Events

Logged via `logAuditEvent` (`lib/audit/log-audit-event.ts`):

| Metadata `audit_action` | When |
|-------------------------|------|
| `campaign_object_saved` | Head record created |
| `version_created` | New version row inserted |
| `lifecycle_changed` | Lifecycle status transition |
| `campaign_object_export` | Export route invoked |

## Validation

```bash
npm run validate:campaign-persistence
npm run build
npx tsc --noEmit
```

## Definition of Done

- [x] Migration with RLS for `campaign_objects` + `campaign_object_versions`
- [x] `CampaignObjectPersistenceService` with save/load/version/compare
- [x] Store-layer autosave after completed specialist tasks
- [x] Restore from DB with contextSnapshot fallback
- [x] Lifecycle enum + transition helpers + API
- [x] Export wired to approved snapshot
- [x] Audit logging on save/version/lifecycle/export
- [x] Phase 0.3 validator script
- [ ] Migration applied to target environment (`supabase db push`)
- [ ] End-to-end runtime test: create-campaign workflow → refresh conversation → verify DB versions

## Remaining Gaps

1. **Migration not applied** — requires operator approval for `supabase db push`
2. **Approval UX** — lifecycle PATCH API exists; Campaign Studio UI not redesigned (per scope)
3. **Compare diff** — `loadVersion` supported; minimal structural diff not implemented
4. **campaign_header_id linkage** — column present; auto-link when campaign header created from workflow TBD
5. **Concurrent writes** — last-write-wins on head; no optimistic locking yet
6. **Integration tests against live Supabase** — validator is static/unit only unless DB env present

## Files Changed (Phase 0.3)

- `supabase/migrations/20260712010000_campaign_object_persistence.sql`
- `features/campaign-intelligence/services/campaign-object-persistence.ts`
- `features/campaign-intelligence/services/campaign-object-store.ts`
- `features/campaign-intelligence/services/campaign-director.ts`
- `features/campaign-intelligence/services/campaign-lifecycle.ts`
- `features/campaign-intelligence/services/campaign-export.ts`
- `features/campaign-intelligence/types/campaign-lifecycle.ts`
- `features/campaign-intelligence/index.ts`
- `features/campaign-intelligence/validate-campaign-persistence-phase03.ts`
- `features/ai-workspace/services/workflow-adapter.ts`
- `features/ai-workspace/services/conversation-campaign-hydration.ts`
- `features/ai-workspace/types/index.ts`
- `app/api/ai/chat/route.ts`
- `app/api/ai/conversations/[id]/route.ts`
- `app/api/ai/campaign-objects/[id]/*`
- `types/database.ts`
- `docs/infrastructure/CAMPAIGN_PERSISTENCE_REPORT.md`
