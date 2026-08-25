# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Converted quotations are no longer expiring offers — Generate link must not fail with “expired”.

- Once a quotation is linked to a campaign (`campaign_header_id` or status `accepted`), offer validity no longer applies. Convert clears `validity_date`; Generate link heals already-converted expired rows.
- Client Workspace share blockers skip expiry for campaign-linked quotations. Workspace status/validity UI no longer shows Expired after convert.

- Open Client Workspace now live-hydrates creator categories, name, engagement, and publications from CRM/enrichment instead of keeping a frozen Beauty snapshot.
- Shortlist “Beauty” tags were imported Facebook/indaHash audience interests (and `#grwm` / Instagram page categories), not a live read of the creator’s content. Display now drops uncorroborated Beauty when another niche exists.
- Interactive reviews overlay live unified creators. Approved / campaign-linked reviews stay frozen.

- Shortlist “Beauty” tags were imported Facebook/indaHash audience interests (and `#grwm` / Instagram page categories), not a live read of the creator’s content. Display now drops uncorroborated Beauty when another niche exists.
- Open Client Workspace previously hydrated CRM metrics only and skipped unified profile sync when every creator had an influencer id. Frozen snapshot categories (Beauty first) never updated after Refresh Metrics.
- Interactive reviews now always overlay live unified creators (bio, publications, display categories). Creator detail reloads live even after `briefFrozenAt`. Approved / campaign-linked reviews stay frozen.

- Ahmed Magdy (`@ahmed_magdyyy__`) stored `Beauty, Fitness, Music, Travel` from **imported** `interest_categories` (no bio/hashtags). Overview used `ai_category` = first tag = Beauty.
- Same dump explains why most of a shortlist looks like Beauty: Instagram audience-interest #1 is often Beauty even for fitness/lifestyle creators. Imported tags are append-only and Apify-protected.
- Display refine: drop Instagram account-type labels (`Digital creator`) and uncorroborated generic Beauty when Fitness (or bio inference) is present. Overview Category uses the same display list.
- Inference: `#grwm` and Instagram `Beauty, cosmetic & personal care` no longer map to Beauty. Real makeup/skincare bios still do.
- Client quotation Cost Detail no longer wipes unit cost to null after Save or remount. Combine creators service-role merge is already live.

- Live Refresh Metrics no longer runs Apify inside the Server Action. Next.js treats every Server Action as a transition; Vercel `FUNCTION_INVOCATION_TIMEOUT` still blanked Discovery even with try/catch.
- Queue to discovery-worker (service-role budget, `force: true`). Bound Redis cancel/enqueue so shortlist batch cannot hang until 300s. Discovery error boundary recovers timeout digests after mount.

- Root cause: after inline live refresh, Next.js used the user JWT for `discovery_apify_usage` / `discovery_control_settings`. RLS allows `discovery.admin` / `analytics.read`, not `discovery.write`, so budget failed closed (`usage_unverified`) and Apify never started. The worker used service-role and bypassed RLS.
- Fix: every Apify launch gate prefers service-role (`assertApifyAcquisitionBudgetForLaunch`). Explicit Refresh Metrics (sheet + shortlist/search batch) uses `force: true` + `live_apify`. Skip is no longer toasted as live Apify success.
- Long Refresh Metrics + Vercel timeout was reported to React 19 `startTransition` and blanked the shortlist (`PlatformErrorBoundary`). Refresh now runs outside transitions, maps digest/timeout to a toast, and does not `router.refresh()` after metrics.
- File SSOT remains `deliverable_assets` / `deliverable_asset_versions` / private `deliverable-assets`.
- Decision SSOT is append-only `campaign_client_content_decisions` (version-specific).
- Campaign tab shows only the **current** asset version as the active review card. Prior versions stay in history.
- New version with no decision → Approval Required. Client approval never publishes or schedules.
- Thinkway files: signed preview/download. Google Drive/external links: View External Link only.
- Original currency is hidden by default. Thinkway toggles it beside Show link on internal Quotation and Shortlist (linked metadata). Clients never see the control.
- Cost and Agency Fees stay visible by default. Thinkway **Hide cost and fees** (same toggle list) shows only Total Investment in Client Workspace calculator, Commercial, and related copy.
- Shortlist creator column shows a compact **Quoted** label when `quotation_refs` exist. The right Quoted column still links the quotation serial.
- Open Client Workspace roster follows live shortlist ∪ quotation membership (add and remove). Frozen snapshots no longer keep creators after they leave both sources.
- Migration `20260823160000_client_content_decisions_and_deliverable_assets_storage_rls` applied on Development and Production.
