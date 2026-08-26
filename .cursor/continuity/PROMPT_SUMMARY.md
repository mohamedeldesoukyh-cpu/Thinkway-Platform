# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Deliverable file upload was aborting with a false “selected deliverable changed” guard (detail stubs `assignmentLineId`). Shipping to Development and Production.

- Campaign Workspace Deliverables → Upload content for client review → **Play uploaded content** now loads the video/image inline (not only a View dialog).
- Client Workspace Campaign → Content to Review shows saved files/Drive embeds; empty copy explains live posts are not review files.
- Received / View upload only counts finished versions. Explorer post rows also see deliverable-level uploads.

**Ship:** Development (`hsxrewjcbvmbkqdlzjhs` · `dev.thinkwaymedia.com`) then Production (`ienowhwfyxoqtzbgltno` · `app.thinkwaymedia.com`) after explicit approval. No schema or data writes.
