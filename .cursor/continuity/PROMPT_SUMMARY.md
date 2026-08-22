# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace — cloned import ER + tiny import avatars

- CRM/Excel imports that stamp one engagement rate onto every platform now show that rate on Instagram only (unless another platform has its own likes/comments). TikTok/YouTube chips keep followers, not the cloned ER.
- Tiny circular import crops (`imports/` · under 20KB) are skipped when a live IG/TT profile exists so Client Workspace can refresh a real photo instead of recropping the badge crop.

**Ship:** Development first (`hsxrewjcbvmbkqdlzjhs`), then Production. Do not dump Stage 3 live tracking onto Production.
