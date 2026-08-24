# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Refresh Metrics queues Apify on the worker — never wait 5 minutes in Next.js

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
