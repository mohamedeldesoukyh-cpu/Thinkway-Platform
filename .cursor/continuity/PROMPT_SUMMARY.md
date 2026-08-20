# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace creator photos

Client Workspace fetches Instagram/TikTok photos when Snapchat is the stored profile. If TikTok/Instagram profile pages block server scrapes, the avatar proxy uses `unavatar.io` (same source as brand logos). Open reviews also backfill a missing snapshot photo from unified Discovery data.

No database changes.

- Dev: https://dev.thinkwaymedia.com  
- Prod: https://app.thinkwaymedia.com (CLI `--prod` + `vercel alias set` — Git `[deploy-production]` does not alias `app.thinkwaymedia.com`)
