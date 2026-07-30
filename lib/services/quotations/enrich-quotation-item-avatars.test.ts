import assert from "node:assert/strict";
import { test } from "node:test";

import { pickBestDisplayableAvatarUrl } from "@/lib/services/quotations/enrich-quotation-item-avatars";
import { pickBestQuotationSeedAvatarUrl } from "@/lib/commercial-sync/shortlist-seeds";

const importCrop =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/abc/instagram/zeinaelfakahany.jpg";
const enrichmentPhoto =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/f2f688c2-5d47-4b07-b34f-7b1ee2ca44f6/instagram/zeinaelfakahany.jpg";
const expiredIgCdn =
  "https://scontent.cdninstagram.com/v/t51.2885-19/x.jpg?oe=60000000";

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

test("quotation seed avatar pick prefers durable storage over expired Instagram CDN", () => {
  assert.equal(
    pickBestQuotationSeedAvatarUrl(expiredIgCdn, enrichmentPhoto),
    enrichmentPhoto
  );
  assert.equal(
    pickBestQuotationSeedAvatarUrl(expiredIgCdn, null, importCrop),
    importCrop
  );
});
