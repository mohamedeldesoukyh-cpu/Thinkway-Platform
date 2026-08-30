# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Creator Workspace operational redesign is on `develop`. Do not touch Production until the user reviews.

## Creator Workspace operational command center

Identity still scopes every query by `influencers.profile_id = auth.uid()`. Greeting/profile name now prefers a human name over agency placeholders such as “Thinkway”. Nav is Home · Campaigns · Deliverables · Payments · Profile. Campaign detail uses tabs (Overview · Brief · Script · Deliverables · Agreement · Publications · Payment · Messages). Brief and script stay separate. Deliverable cards preview the signed file (not filename-only). Publication is a separate step from upload. Insights stay secondary to next actions.

Regression: `npm run test:creator-workspace-phase5` (includes Phase 1–4). Onboarding: `npm run test:creator-workspace-onboarding`.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional. Client Workspace does not consume creator insights.

## Phase 4 still true

Optional creator-authorized connections. Instagram adapter-ready when env is set; others Available soon. Tokens in `creator_social_credentials`.

## Still true from earlier

- Internal `/vendors/[id]` is **Creator Profile**. Creator product is `/creator-portal`.
- Linking chain: User → `influencers.profile_id` → `campaign_influencers` → campaign / units / vendor IO / payments / publications.
