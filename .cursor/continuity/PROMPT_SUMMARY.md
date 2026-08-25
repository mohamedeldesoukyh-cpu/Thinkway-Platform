# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Client Workspace header must show the legal entity / group, never the brand.

- The partner slot next to THINKWAY was still rendering `campaignName` (Cofftea Egypt). That is the brand/shortlist title, not the client.
- Header now shows THINKWAY + group/client logo or name only. Brand and campaign titles are never used there.
- Live identity lookup also resolves `brands.client_id` from the brand/campaign name when the shortlist has no `client_id`.

**Ship:** Development first (`hsxrewjcbvmbkqdlzjhs`). Production only after explicit approval.
