# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Limitless `TW-2026-2` — Deliverables reel upload must not crash the tab.

- Staff upload stays in Campaign Workspace Deliverables documentation (`deliverable-assets` bucket, 100 MB/file, org Pro file storage 100 GB).
- Default Deliverables explorer opens client-review upload; Client Workspace remains view/approve only.
- Large reels were sent as base64 Server Actions and crashed the tab (`An unexpected response was received from the server`). Files now upload via signed URL directly to storage; errors toast instead of taking down Deliverables.

**Ship:** Development (`hsxrewjcbvmbkqdlzjhs` · `dev.thinkwaymedia.com`) then Production (`ienowhwfyxoqtzbgltno` · `app.thinkwaymedia.com`) after explicit approval. No schema or data writes.
