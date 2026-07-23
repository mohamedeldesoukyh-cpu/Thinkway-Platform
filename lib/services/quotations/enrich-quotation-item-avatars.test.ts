import assert from "node:assert/strict";
import { test } from "node:test";

import { pickBestDisplayableAvatarUrl } from "@/lib/services/quotations/enrich-quotation-item-avatars";

const importCrop =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/abc/instagram/zeinaelfakahany.jpg";
const enrichmentPhoto =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/f2f688c2-5d47-4b07-b34f-7b1ee2ca44f6/instagram/zeinaelfakahany.jpg";

test("quotation workspace avatar pick prefers enrichment over import primary", () => {
  const resolved = pickBestDisplayableAvatarUrl(importCrop, enrichmentPhoto);
  assert.equal(resolved, enrichmentPhoto);
});

test("quotation workspace avatar pick keeps enrichment when primary is listed first", () => {
  assert.equal(
    pickBestDisplayableAvatarUrl(importCrop, null, enrichmentPhoto),
    enrichmentPhoto
  );
});
