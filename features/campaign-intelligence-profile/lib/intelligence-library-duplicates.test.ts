import assert from "node:assert/strict";
import type { CampaignIntelligenceLibraryItem } from "@/lib/domains/intelligence/types";
import {
  buildIntelligenceLibraryNote,
  countDuplicateRecords,
  duplicateRecordIdSet,
  findIntelligenceDuplicateGroups,
} from "./intelligence-library-duplicates";

function item(
  partial: Partial<CampaignIntelligenceLibraryItem> &
    Pick<CampaignIntelligenceLibraryItem, "id" | "title" | "createdAt">
): CampaignIntelligenceLibraryItem {
  return {
    status: "saved",
    brandId: "b1",
    brandName: "NBK Bank",
    clientId: "c1",
    clientName: "Wavemaker",
    campaignHeaderId: null,
    campaignName: null,
    campaignDocumentNumber: null,
    fileName: null,
    updatedAt: partial.createdAt,
    createdBy: "u1",
    ...partial,
  };
}

const nbkA = item({
  id: "1",
  title: "NBK Bank",
  createdAt: "2026-08-04T03:26:00.000Z",
});
const nbkB = item({
  id: "2",
  title: "NBK Bank",
  createdAt: "2026-08-04T00:37:00.000Z",
});
const noonA = item({
  id: "3",
  title: "Noon",
  brandName: "Noon",
  brandId: "b2",
  createdAt: "2026-08-04T01:16:00.000Z",
});
const noonB = item({
  id: "4",
  title: "Noon",
  brandName: "Noon",
  brandId: "b2",
  createdAt: "2026-08-04T02:16:00.000Z",
});
const unique = item({
  id: "5",
  title: "Arab Bank",
  brandName: "Arab Bank",
  brandId: "b3",
  createdAt: "2026-08-03T23:38:00.000Z",
});

const portfolio = [nbkA, nbkB, noonA, noonB, unique];
const groups = findIntelligenceDuplicateGroups(portfolio);
assert.equal(groups.length, 2);
assert.equal(countDuplicateRecords(portfolio), 4);
assert.deepEqual([...duplicateRecordIdSet(groups)].sort(), ["1", "2", "3", "4"]);

const note = buildIntelligenceLibraryNote(groups, portfolio.length);
assert.ok(note.startsWith("4 of 5 records look like duplicates"));
assert.ok(note.includes("same brief title, brand and legal entity"));
assert.ok(note.includes("NBK Bank"));
assert.ok(note.includes("3 hours apart"));
assert.ok(note.includes("Review before running Discovery"));
assert.ok(note.includes("Search runs Discovery against it"));

assert.ok(
  buildIntelligenceLibraryNote([], 5).includes("Open shows the brief itself")
);

console.log("OK — intelligence-library-duplicates (scale-first note)");
