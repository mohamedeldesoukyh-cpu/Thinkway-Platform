# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Raise deliverable uploads to 150 MB; Client Workspace must play Omar’s `.MOV` story.

- Cap: 150 MiB in the app, `deliverable-assets` bucket, and project-wide Storage `fileSizeLimit` (or TUS 413s at the old 100 MB).
- Play / Full size: do not point `<video>` at a Storage URL ending in `.MOV`. Fetch bytes and play a `blob:` URL typed as `video/mp4`.
