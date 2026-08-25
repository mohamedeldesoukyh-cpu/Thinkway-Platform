# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Standalone client logos (no Group) must show next to Thinkway.

- Bundle Plus (`CIT-000003`) had a client logo on the legal entity form, but Client Workspace / Client Portal still omitted it. Frozen reviews skipped live overlay; quotations without `client_id` never resolved the legal entity; Client Portal RLS blocked `clients.logo_url`.
- Live identity overlay now always runs (including historical reviews). Resolver tries quotation / shortlist / campaign / brand client ids, then matches `clientLabel` / `CIT-…` / `name_normalized`. Portal loads logo via service-role.
- Legal entity and group workspace chrome show the uploaded mark next to the name. Upload refreshes that chrome immediately.

**Ship:** Development first (`hsxrewjcbvmbkqdlzjhs`). Production only after explicit approval.
