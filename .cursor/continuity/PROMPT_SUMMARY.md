# Prompt Summary — Current Sprint

**Branch:** `develop` · Production already has Stage 1 + Stage 2  
**Focus:** Client Workspace Stage 3 — live / publication tracking on the Campaign tab (local, not committed)

Campaign tab now projects Campaign Workspace `assignment_post_schedule` + `campaign_publications` as a read-only client view: Scheduled / Due today / Overdue / Live / Completed (`verified`). Cancelled posts are hidden. Publication date, content URL, and stored performance metrics appear only when real (actual over forecast). Historical reviews do not overlay live execution.

- Tests: Client Workspace 158 passing · `npx tsc --noEmit` pass · eslint on touched files pass  
- Do not commit / push / deploy until review
