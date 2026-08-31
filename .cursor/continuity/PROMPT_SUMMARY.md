# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace share controls on Shortlist, Quotation, and Campaign lists.

- `/campaigns`, Shortlists, and Client Quotations show the same Client link cell (Active / Off / None, toggle, Stop, View).
- Stop / Activate / View on any of those lists hit the same Client Workspace journey, so the share URL stays shared across shortlist → quotation → campaign.
- List mutations go through `POST /api/client-workspace/link` (not Server Actions).

## Creator Workspace mock application

Chrome is `CreatorWorkspaceShell` (white top bar + sticky Home · Campaigns · Deliverables · Calendar · Payments · Profile). Client Portal is unchanged. Campaign tabs are Overview · Brief · Deliverables · Agreement · Payment. Script lives on deliverable cards. Payment is an informational strip on Home, not a next action. Calendar events come only from deliverable due dates and campaign start/end.

**Browser QA:** not completed in this environment (no creator credentials). Automated: `npm run test:creator-workspace-phase5` · `npx tsc --noEmit`.

## Creator Workspace QA (this pass)

Next-action copy is shared: agreement → deliverables → publication URL → **Payment pending** → All on track. Home no longer says “Payment in progress”. Video preview streams the owned signed URL immediately (`<source type=video/mp4>`); blob retype is a fallback for small QuickTime files only. Loading/error routes added.

**Browser QA:** not completed in this environment (no creator credentials, browser MCP unavailable). Automated: `npm run test:creator-workspace-phase5` · `npx tsc --noEmit`.

## Creator Workspace visual family

Creator uses `PortalShell` `navVariant="compact"` (`w-64`, muted active row, no blue pills, no bottom app bar). Client Portal is unchanged (`pills` default). Campaign tabs stay inside the campaign page.

## Creator Workspace operational command center

Identity still scopes every query by `influencers.profile_id = auth.uid()`. Nav is Home · Campaigns · Deliverables · Payments · Profile. Brief and script stay separate. Publication is a separate step from upload.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
