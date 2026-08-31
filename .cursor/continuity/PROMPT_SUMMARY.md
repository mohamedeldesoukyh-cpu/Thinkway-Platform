# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace share controls on Shortlist, Quotation, and Campaign lists.

- `/campaigns`, Shortlists, and Client Quotations show the same Client link cell (Active / Off / None, toggle, Stop, View).
- Stop / Activate / View on any of those lists hit the same Client Workspace journey, so the share URL stays shared across shortlist → quotation → campaign.
- List mutations go through `POST /api/client-workspace/link` (not Server Actions).
- Stop keeps the journey token; Activate restores the same `/review/{id}?sign=` address.
- Stopped client links open a dimmed workspace with “This workspace link has expired” and **Request access**.
- Client Workspace Publication plan (Creators and go-live): likes/views stay visible on mobile.
