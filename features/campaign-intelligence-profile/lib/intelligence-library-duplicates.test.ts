import assert from "node:assert/strict";
import type { CampaignIntelligenceLibraryItem } from "@/lib/domains/intelligence/types";
import {
  buildIntelligenceLibraryNote,
  countDuplicateRecords,
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
const noon = item({
  id: "3",
  title: "Noon",
  brandName: "Noon",
  createdAt: "2026-08-04T01:16:00.000Z",
});

const groups = findIntelligenceDuplicateGroups([nbkA, nbkB, noon]);
assert.equal(groups.length, 1);
assert.equal(groups[0]!.title, "NBK Bank");
assert.equal(countDuplicateRecords([nbkA, nbkB, noon]), 2);

const note = buildIntelligenceLibraryNote(groups);
assert.ok(note.includes("Search runs Discovery against it"));
assert.ok(note.includes("Open shows the brief itself"));
assert.ok(note.includes("NBK Bank"));
assert.ok(note.includes("duplicate"));

assert.ok(
  buildIntelligenceLibraryNote([]).includes("Open shows the brief itself")
);

console.log("OK — intelligence-library-duplicates");
