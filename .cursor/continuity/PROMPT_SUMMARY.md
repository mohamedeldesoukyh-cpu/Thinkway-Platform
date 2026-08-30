# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace campaign surfaces.

- `/campaigns` Client link: Active (pulse + View) / Off / None, plus **toggle** to activate and **Stop** to revoke.
- List View reveals an existing share URL; toggle On can mint a link. Stop turns the live review off without rotating the journey token; Activate restores that same `/review/{id}?sign=` address.
- Stopped client links open a dimmed workspace with “This workspace link has expired” and **Request access** (email to traffic@thinkwaymedia.com).
- List Stop / Activate / View go through `POST /api/campaigns/[id]/client-link` (not Server Actions) so Next does not re-render `/campaigns` and toast a masked digest while the row stays Active.
- Campaign list headers wrap so labels like Group · Legal entity stay readable.
- Client Workspace Publication plan (Creators and go-live): likes/views stay visible on mobile because Performance is hidden below 760px; metrics render on creator and deliverable rows.
