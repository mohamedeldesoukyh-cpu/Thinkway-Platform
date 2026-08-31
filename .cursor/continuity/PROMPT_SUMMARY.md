# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Creator Workspace QA fixes (next-action copy + signed-URL video playback). Do not touch Production. Do not commit until the user asks.

## Creator Workspace QA (this pass)

Next-action copy is shared: agreement → deliverables → publication URL → **Payment pending** → All on track. Home no longer says “Payment in progress”. Video preview streams the owned signed URL immediately (`<source type=video/mp4>`); blob retype is a fallback for small QuickTime files only. Loading/error routes added. Client Workspace was not changed.

**Browser QA:** not completed in this environment (no creator credentials, browser MCP unavailable). Automated: `npm run test:creator-workspace-phase5` · `npx tsc --noEmit`.

## Creator Workspace visual family

Creator uses `PortalShell` `navVariant="compact"` (`w-64`, muted active row, no blue pills, no bottom app bar). Client Portal is unchanged (`pills` default). Campaign tabs stay inside the campaign page.

## Creator Workspace operational command center

Identity still scopes every query by `influencers.profile_id = auth.uid()`. Nav is Home · Campaigns · Deliverables · Payments · Profile. Brief and script stay separate. Publication is a separate step from upload.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional. Client Workspace does not consume creator insights.
