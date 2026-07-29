import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  asCommercialLineId,
  assertOriginPreserved,
  assignmentBelongsToCommercialLine,
  buildRegistryEntry,
  indexAssignmentsByCommercialLineId,
  originCommercialLineId,
} from "./commercial-line-identity";

describe("Commercial Line Identity", () => {
  it("treats quotation item id as immutable Commercial Line ID", () => {
    assert.equal(asCommercialLineId("cml-001"), "cml-001");
    assert.throws(() => asCommercialLineId("  "));
  });

  it("reads Origin from Assignment source_quotation_item_id", () => {
    assert.equal(
      originCommercialLineId({ source_quotation_item_id: "CML-001" }),
      "CML-001"
    );
    assert.equal(
      originCommercialLineId({ source_quotation_item_id: null }),
      null
    );
  });

  it("builds 1:N registry entries by Origin, never by position", () => {
    const entry = buildRegistryEntry({
      quotationId: "q1",
      quotationItemId: "CML-010",
      assignments: [
        { id: "a-july", source_quotation_item_id: "CML-010", campaign_header_id: "ch1" },
        { id: "a-aug", source_quotation_item_id: "CML-010", campaign_header_id: "ch1" },
        { id: "a-other", source_quotation_item_id: "CML-999", campaign_header_id: "ch1" },
      ],
    });

    assert.equal(entry.commercialLineId, "CML-010");
    assert.deepEqual(entry.assignmentIds, ["a-july", "a-aug"]);
    assert.equal(entry.campaignHeaderId, "ch1");
    assert.equal(
      assignmentBelongsToCommercialLine(
        { source_quotation_item_id: "CML-010" },
        "CML-010"
      ),
      true
    );
  });

  it("indexes assignments by Commercial Line ID for deterministic sync", () => {
    const map = indexAssignmentsByCommercialLineId([
      { id: "1", source_quotation_item_id: "A" },
      { id: "2", source_quotation_item_id: "A" },
      { id: "3", source_quotation_item_id: "B" },
      { id: "4", source_quotation_item_id: null },
    ]);
    assert.deepEqual(map.get("A"), ["1", "2"]);
    assert.deepEqual(map.get("B"), ["3"]);
    assert.equal(map.has("4" as never), false);
  });

  it("forbids clearing or rewriting Origin Commercial Line IDs", () => {
    assert.equal(
      assertOriginPreserved({ before: "CML-1", after: "CML-1" }).ok,
      true
    );
    assert.equal(
      assertOriginPreserved({ before: "CML-1", after: "CML-2" }).ok,
      false
    );
    assert.equal(
      assertOriginPreserved({ before: "CML-1", after: null }).ok,
      false
    );
  });
});
