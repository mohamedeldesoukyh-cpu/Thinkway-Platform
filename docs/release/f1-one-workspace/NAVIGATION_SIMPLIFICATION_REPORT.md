# F1.1 Navigation Simplification Report

## Before

- `/ai/[conversationId]` — AI chat with Campaign Studio embedded in messages
- `/ai/[conversationId]/decisions` — separate **Campaign Studio | Decision Workspace** tabs

Users would need a second route to access decision simulation.

## After

- `/ai/[conversationId]` — everything in one URL:
  - AI Chat
  - Campaign Studio (Presentation default)
  - Decision Mode toggle
  - Scenario Bar, Right Panel, Creator Drawer (Decision Mode only)

## Removed from User Navigation

- Decision Workspace tab in `CampaignIntelligenceShell`
- No app-wide nav links to `/decisions` (none existed outside the dev shell)

## Preserved (Internal Dev)

- Route: `/ai/[conversationId]/decisions`
- Page: `app/(dashboard)/ai/[conversationId]/decisions/page.tsx`
- Shell: `CampaignIntelligenceShell` — now loads `CampaignStudioHost` directly (no tabs)
- Standalone: `DecisionWorkspace` component kept in codebase

## User Flow

1. User creates campaign via AI chat → Campaign Studio appears in thread
2. When workflow complete, **Presentation | Decision Mode** toggle appears above studio
3. Decision Mode enables scenario simulation without leaving the conversation
4. Promote writes back → Presentation view updates on next render

## Nav Diagram

```
/ai
 └── /[conversationId]          ← primary (chat + studio + decision toggle)
      └── /decisions            ← dev only, no nav links
```
