# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace Content to Review + original-currency toggle

- File SSOT remains `deliverable_assets` / `deliverable_asset_versions` / private `deliverable-assets`.
- Decision SSOT is append-only `campaign_client_content_decisions` (version-specific).
- Campaign tab shows only the **current** asset version as the active review card. Prior versions stay in history.
- New version with no decision → Approval Required. Client approval never publishes or schedules.
- Thinkway files: signed preview/download. Google Drive/external links: View External Link only.
- Original currency is hidden by default. Thinkway toggles it beside Show link on internal Quotation and Shortlist (linked metadata). Clients never see the control.
- Cost and Agency Fees stay visible by default. Thinkway **Hide cost and fees** (same toggle list) shows only Total Investment in Client Workspace calculator, Commercial, and related copy.
- Migration `20260823160000_client_content_decisions_and_deliverable_assets_storage_rls` applied on Development and Production.

**Ship:** Development (`hsxrewjcbvmbkqdlzjhs`) and Production (`ienowhwfyxoqtzbgltno`) for this release.
