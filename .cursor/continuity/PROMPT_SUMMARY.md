# Prompt Summary — Current Sprint

**Branch:** `feature/client-workspace-creator-report-data` (from `develop`)  
**Focus:** Client Workspace creator detail, snapshots, and advanced report (Development only)

Creator snapshots were blank because the public review link cannot hotlink Instagram/TikTok CDNs, and freeze-on-read kept the slim Search feed (thumbs with likes/comments/views stripped). Fix: freeze full publications, backfill slim frozen reviews once, and render avatars/thumbs through signed `/api/review/media` (token + snapshot allowlist). Creator detail and View advanced report now use the HTML layout sections with real frozen data (content grid, audience, demographics, historical). Missing values stay Not available / To be confirmed. No AQS / ROI / bot pie.

Do **not** deploy Production.

Dev: https://dev.thinkwaymedia.com — open the signed review, tap a creator (loads/backfills the brief), then View advanced report.
