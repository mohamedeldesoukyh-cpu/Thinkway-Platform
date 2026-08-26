# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Campaign Deliverables upload list was a flat dump of every post, so reel slots still showed the package mix (“IG Story + 31 more”) and unfinished files still read as Missing.

- Repository groups by creator → type (Reel vs Story), collapses large type groups, and highlights the exact slot being uploaded (`Reel #1`).
- Right card title is the slot, not the creator. Unfinished uploads show **Incomplete**, not Missing.
- Type filter + default asset type (story → screenshot, reel → draft video).

**Ship:** Development (`hsxrewjcbvmbkqdlzjhs` · `dev.thinkwaymedia.com`) then Production (`ienowhwfyxoqtzbgltno` · `app.thinkwaymedia.com`) after explicit approval. No schema or data writes.
