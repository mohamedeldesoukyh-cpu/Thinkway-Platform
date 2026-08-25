# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Limitless `TW-2026-2` — Deliverables upload + Client Workspace live publications.

- Staff upload stays in Campaign Workspace Deliverables documentation (`deliverable_assets`). Client Workspace Campaign tab remains view/approve only.
- Default Deliverables tab hid upload because documentation only opened via `?docsCreator=` / `?deliverable=`. Explorer now has **Upload content for client review** (header, row, detail sheet) and opens docs in local state (tab changes use `history.replaceState`, which does not update Next searchParams).
- Client Campaign Live dropped Performance publications with a URL/date but no assignment FK. Projection now matches leftover pubs by line or influencer, does not consume them onto cancelled posts, and still emits them as live rows (e.g. `nadineladki14`).

**Ship:** Development (`hsxrewjcbvmbkqdlzjhs` · `dev.thinkwaymedia.com`) then Production (`ienowhwfyxoqtzbgltno` · `app.thinkwaymedia.com`) after explicit approval. No schema or data writes.
