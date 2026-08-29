# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Campaign Script original documents — preserve the uploaded client file on the same documentation unit as the script. Stopped after implementation and testing.

- Original bytes live in the existing `deliverable-assets` bucket. Metadata (`original_storage_bucket/path/mime/size`) is on append-only `campaign_script_revisions`. Not a `deliverable_assets` row.
- Path: `{campaignHeaderId}/{assignmentDeliverableId}/{postId|deliverable}/{revisionId}/{fileName}`. Existing storage RLS (first folder = campaign UUID) applies.
- Compact file icon next to Script/Preview on Internal Deliverables documentation units and Client Publication Plan rows. Download + PDF preview. Filename in the menu.
- Text edit / language / translation carry the previous original forward. Replacement inserts a new revision + new object; prior objects stay.
- Signed URLs load the current unit script; they never accept a client-supplied path. Reel 1’s original is never returned for Reel 2.
- Development only (`hsxrewjcbvmbkqdlzjhs`). Production schema/UI deploy requires approval.
