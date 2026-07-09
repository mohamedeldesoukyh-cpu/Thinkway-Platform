import assert from "node:assert/strict";

import {
  brandLinkSearchKeywords,
  buildBrandLinkDialogOptions,
  resolveDefaultBrandSelection,
  type BrandSelectRow,
} from "./build-brand-link-dialog-options";
import type { BrandDetectionResult } from "./match-brand-from-profile";

const allBrands: BrandSelectRow[] = [
  { id: "brand-a", name: "Adidas", clientId: "c1", clientName: "Adidas Group" },
  { id: "brand-etisalat", name: "Etisalat", clientId: "c2", clientName: "Etisalat Group" },
  { id: "brand-z", name: "Zara", clientId: "c3", clientName: "Zara Retail" },
];

const detection: BrandDetectionResult = {
  candidates: [
    {
      brandId: "brand-etisalat",
      brandName: "Etisalat",
      clientId: "c2",
      clientName: "Etisalat Group",
      confidence: 0.95,
    },
  ],
  bestMatch: {
    brandId: "brand-etisalat",
    brandName: "Etisalat",
    clientId: "c2",
    clientName: "Etisalat Group",
    confidence: 0.95,
  },
  extractedBrandName: "Etisalat",
  extractedClientName: null,
  hasReliableBrandHint: true,
};

const merged = buildBrandLinkDialogOptions(allBrands, detection);
assert.equal(merged.length, 3);
assert.equal(merged[0]?.brandId, "brand-etisalat");
assert.deepEqual(
  merged.map((row) => row.brandId),
  ["brand-etisalat", "brand-a", "brand-z"]
);

const detectionOnly = buildBrandLinkDialogOptions([], detection);
assert.equal(detectionOnly.length, 1);
assert.equal(detectionOnly[0]?.brandId, "brand-etisalat");

const filteredDetection = buildBrandLinkDialogOptions(
  [{ id: "brand-a", name: "Adidas", clientId: "c1", clientName: "Adidas Group" }],
  detection
);
assert.equal(filteredDetection.length, 1);
assert.equal(filteredDetection[0]?.brandId, "brand-a");

assert.ok(brandLinkSearchKeywords("E&", "Etisalat Group").includes("Etisalat"));

const singleBrandDefault = resolveDefaultBrandSelection(
  [{ brandId: "brand-etisalat", brandName: "E&", clientName: "Etisalat Group" }],
  {
    candidates: [],
    bestMatch: null,
    extractedBrandName: "E& / Esalat",
    extractedClientName: null,
    hasReliableBrandHint: true,
  }
);
assert.equal(singleBrandDefault, "brand-etisalat");

console.log("build-brand-link-dialog-options tests passed");
