# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace — priced creators first in display lists

Client Workspace Shortlist, Your Selection, and Overview now show priced creators (`investmentAmount > 0`) before unpriced ones. Display-only: freeze `creatorIds`, overlay merge order, calculator totals, and quotation approval are unchanged. Zero or missing price counts as unpriced.

- Tests: Client Workspace 159 passing · `npx tsc --noEmit` pass · eslint on touched files pass  
- Stage 3 Campaign live/publication tracking remains on Development (`d5c381d7`); not part of this Production cherry-pick
