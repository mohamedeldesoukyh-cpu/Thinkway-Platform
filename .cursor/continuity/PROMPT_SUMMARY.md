# Prompt Summary — Current Sprint

**Branch:** `develop`  
**Focus:** Client Workspace Content to Review (version-specific content approval)

- File SSOT remains `deliverable_assets` / `deliverable_asset_versions` / private `deliverable-assets`.
- Decision SSOT is append-only `campaign_client_content_decisions` (version-specific).
- Campaign tab shows only the **current** asset version as the active review card. Prior versions stay in history.
- New version with no decision → Approval Required. Client approval never publishes or schedules.
- Thinkway files: signed preview/download. Google Drive/external links: View External Link only.
- Development migration `20260823160000_client_content_decisions_and_deliverable_assets_storage_rls` — Dev only.

**Ship:** Development first (`hsxrewjcbvmbkqdlzjhs`). Do not dump onto Production unless asked. Do not commit unless asked.
