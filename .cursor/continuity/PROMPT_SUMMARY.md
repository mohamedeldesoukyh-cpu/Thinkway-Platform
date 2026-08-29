# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace mobile layout — Campaign tab plus Shortlist, Your Selection, Commercial, Overview, and chrome.

- Campaign tab: compact `cx-script-btn` (not inflated `.btn`); hide lower-priority publication-plan columns below 760px.
- Overview: stack analysis/strategy grids; do not keep `min-width: 280px` on the executive summary (it overflowed phones). Mobile overrides sit after the Overview CSS so they win the cascade.
- Shortlist / Your Selection: filter chips scroll; Remove sits under the creator card instead of beside the photo.
- Header CTAs stack full-width; journey hints hide; Commercial totals and Feedback KPI strip tighten.
- Development only (`hsxrewjcbvmbkqdlzjhs`). Production schema/UI deploy requires approval.
