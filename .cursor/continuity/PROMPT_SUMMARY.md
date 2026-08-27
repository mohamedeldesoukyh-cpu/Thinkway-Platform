# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** ~80 MB Instagram story kept failing with “must be 100 MB or smaller.”

- App TUS path is live (`440fad00`). Standard PUT is still capped at 50 MB; large files use resumable TUS.
- Real blocker after that: **project-wide Storage `fileSizeLimit` was 50 MB**, so TUS returned `413 Maximum size exceeded` even though the `deliverable-assets` bucket allows 100 MB.
- Raised Storage `fileSizeLimit` to **104857600 (100 MB)** on Development (`hsxrewjcbvmbkqdlzjhs`) and Production (`ienowhwfyxoqtzbgltno`). No schema migration.

**Retry:** Hard-refresh Production, stay on Instagram story #1, choose the MOV again. Wait for the percent meter.
