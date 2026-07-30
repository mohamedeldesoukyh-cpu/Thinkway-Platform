import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendMediaPlanEditHistoryEntry,
  buildMediaPlanEditHistoryEntry,
  pageMediaPlanEditHistory,
  restoreMediaPlanEditOnRecord,
  summarizeMediaPlanEditDiff,
} from "./media-plan-edit-history";
import type { CampaignOutputContent, CampaignOutputRecord } from "./output-types";

function planContent(opts: {
  weeks: number;
  end?: string;
  creators?: Array<{ id: string; name: string }>;
}): CampaignOutputContent {
  const creators = opts.creators ?? [];
  return {
    title: "Media Plan",
    sections: [],
    data: {
      durationWeeks: opts.weeks,
      campaignStartDate: "2026-07-04",
      campaignEndDate: opts.end ?? "2026-08-01",
      weeks: [
        {
          week: 1,
          wave: 1,
          phase: "launch",
          days: creators.map((c, i) => ({
            day: "Sat",
            type: "publish",
            label: c.name,
            creatorId: c.id,
            creator: c.name,
          })),
        },
      ],
      waves: [],
      milestones: [],
      platformAllocation: {},
      dependencies: [],
      deadlines: [],
      creatorCount: creators.length,
      serviceTypes: [],
      generatorVersion: "test",
    },
  };
}

function baseRecord(content?: CampaignOutputContent): CampaignOutputRecord {
  return {
    kind: "media_plan",
    status: "generated",
    version: 1,
    versionMajor: 1,
    versionMinor: 0,
    versionLabel: "v1.0",
    content,
    editHistory: [],
  };
}

describe("media-plan-edit-history", () => {
  it("summarizes creator add/remove and duration changes", () => {
    const before = planContent({
      weeks: 4,
      creators: [{ id: "a", name: "Alice" }],
    });
    const after = planContent({
      weeks: 6,
      end: "2026-08-15",
      creators: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
    });
    const diff = summarizeMediaPlanEditDiff(before, after);
    assert.ok(diff.addedCreatorIds.includes("b"));
    assert.equal(diff.removedCreatorIds.length, 0);
    assert.ok(diff.fieldChanges.some((c) => c.field === "durationWeeks"));
    assert.match(diff.summary, /Added 1 creator/);
  });

  it("keeps all edit history (no delete cap) and pages latest 50", () => {
    let record = baseRecord();
    for (let i = 0; i < 120; i++) {
      record = {
        ...record,
        editHistory: appendMediaPlanEditHistoryEntry(record, {
          at: new Date().toISOString(),
          actorKind: "user",
          summary: `Edit ${i + 1}`,
          detailLines: [],
          fieldChanges: [],
          affectedCreatorCount: 0,
        }),
      };
    }
    assert.equal(record.editHistory?.length, 120);
    const page = pageMediaPlanEditHistory(record.editHistory, { limit: 50 });
    assert.equal(page.items.length, 50);
    assert.equal(page.items[0]?.editNumber, 120);
    assert.equal(page.hasMore, true);
  });

  it("restore is append-only and does not change business version label", () => {
    const c1 = planContent({ weeks: 4, creators: [{ id: "a", name: "Alice" }] });
    const c2 = planContent({
      weeks: 5,
      creators: [
        { id: "a", name: "Alice" },
        { id: "b", name: "Bob" },
      ],
    });
    let record = baseRecord(c1);
    const e1 = buildMediaPlanEditHistoryEntry({
      record,
      beforeContent: undefined,
      afterContent: c1,
      actorKind: "user",
      operationClass: "edit_generate",
    });
    record = { ...record, editHistory: appendMediaPlanEditHistoryEntry(record, e1), content: c1 };

    const e2 = buildMediaPlanEditHistoryEntry({
      record,
      beforeContent: c1,
      afterContent: c2,
      actorKind: "user",
      operationClass: "edit_revise",
    });
    record = { ...record, editHistory: appendMediaPlanEditHistoryEntry(record, e2), content: c2 };

    const restored = restoreMediaPlanEditOnRecord(record, 1, { actorKind: "user" });
    assert.ok(restored);
    assert.equal(restored!.record.versionLabel, "v1.0");
    assert.equal(restored!.record.editHistory?.length, 3);
    const tip = restored!.record.editHistory?.[2];
    assert.equal(tip?.restoredFromEditNumber, 1);
    assert.match(tip?.summary ?? "", /Restored from Edit 1/);
    assert.equal(
      (restored!.content.data as { durationWeeks?: number })?.durationWeeks,
      4
    );
  });
});
