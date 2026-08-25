# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace identity (client, not brand) and existing share links.

- Partner slot is group logo, else client logo, else group/client **name**. Brand marks and brand titles are never used as the Thinkway partner identity.
- Shortlist and quotation **Show link** was flipping to **Generate link** and minting a second URL: quotation created instead of revealing, peek used staff JWT (RLS miss), superseded counted as missing, versioned quotations peeked only the current `quotation_id`, and `hasLink` ignored local cache.
- Peek/reveal now use service-role when available, walk the quotation family, treat any non-revoked review as an existing share, and create only if the link is truly missing.

**Ship:** Development first (`hsxrewjcbvmbkqdlzjhs`). Production only after explicit approval.
