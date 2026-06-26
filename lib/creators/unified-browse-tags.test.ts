import assert from "node:assert/strict";

import { mergeImportedStringArrays } from "@/lib/discovery-import/normalize";

/** Mirrors tagsFromImportMetadata in unified-browse.ts */
function tagsFromImportMetadata(
  metadata: Record<string, unknown> | null | undefined
): string[] {
  return mergeImportedStringArrays(
    (metadata?.categories as string[] | undefined) ?? [],
    (metadata?.audience_interests as string[] | undefined) ?? []
  );
}

function mergeCreatorCategories(
  influencerCategories: string[],
  metadata: Record<string, unknown> | null | undefined
): string[] {
  return mergeImportedStringArrays(influencerCategories, tagsFromImportMetadata(metadata));
}

assert.deepEqual(
  mergeCreatorCategories([], {
    audience_interests: ["Camera & Photography", "Beauty & Cosmetics"],
    categories: [],
  }),
  ["Camera & Photography", "Beauty & Cosmetics"]
);

assert.deepEqual(
  mergeCreatorCategories(["Beauty"], {
    audience_interests: ["Camera & Photography"],
    categories: ["Fashion"],
  }),
  ["Beauty", "Fashion", "Camera & Photography"]
);

console.log("lib/creators/unified-browse-tags.test.ts — all tests passed");
