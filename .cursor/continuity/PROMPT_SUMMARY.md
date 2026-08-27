# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** iPhone/Windows `.MOV` uploads were rejected as `application/octet-stream`. Shipping MIME normalization so reels/stories upload as `video/quicktime`.

- Deliverables repository groups by creator → type and highlights the exact slot.
- Unfinished uploads show **Incomplete**. `.MOV` with a generic Windows type now maps to QuickTime.
- Files still must be MP4/MOV **under 100 MB**.

**Ship:** Development (`hsxrewjcbvmbkqdlzjhs` · `dev.thinkwaymedia.com`) then Production (`ienowhwfyxoqtzbgltno` · `app.thinkwaymedia.com`) after explicit approval. No schema or data writes.
