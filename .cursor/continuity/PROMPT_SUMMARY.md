# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Manual Refresh Metrics starts live Apify inline (no worker wait)

- Manual Refresh Metrics runs live Apify in the Next.js server action. Queue-only refresh never started an actor when discovery-worker was offline.
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

**Ship:** Development (`hsxrewjcbvmbkqdlzjhs`) and Production (`ienowhwfyxoqtzbgltno`) for Refresh Metrics live Apify.
