# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Creator Workspace Phases 1–5 are on `develop` for Development testing. Do not touch Production until the user reviews.

## Phase 5 — Creator Insights & Smart Recommendations (in review)

Evidence-based “what should this creator do next?” — not a BI dashboard. Package: `lib/creator-insights/` (not ECI, not a second metrics SSOT). Reads `campaign_publications` + `creator_social_insights`. Deterministic facts/baselines; optional OpenAI wording only. Cache keyed by influencer + data fingerprint; invalidated after social sync. Creator Home compact Thinkway Insights (1–3). Internal Creator Profile performance snapshot. Social connection remains optional. No new nav, no Client Workspace exposure, no new tables.

Regression: `npm run test:creator-workspace-phase5` (includes Phase 1–4).

## Phase 4 still true

Optional creator-authorized connections. Instagram adapter-ready when env is set; others Available soon. Tokens in `creator_social_credentials`. Dev migration `20260830220000_creator_social_connections.sql` already applied to Development.

## Phase 3 still true

Internal on-behalf uses the same documentation-unit SSOT. No IO/legal/OAuth on behalf.

## Still true from earlier

- Internal `/vendors/[id]` is **Creator Profile**. Creator product is `/creator-portal` (4-nav). Social lives on Profile, not a new nav item.
