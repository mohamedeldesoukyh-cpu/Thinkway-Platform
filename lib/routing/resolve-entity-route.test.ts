import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickEntityIdBySlugMatch } from "./resolve-entity-route";

describe("pickEntityIdBySlugMatch", () => {
  const shortlistId = "d5170908-e5f6-4789-a012-3456789abcde";
  const otherId = "aaaaaaaa-e5f6-4789-a012-3456789abcde";

  it("matches slug and short id", () => {
    assert.equal(
      pickEntityIdBySlugMatch(
        [
          {
            id: shortlistId,
            name: "Wavemaker x NBK Bank - Summer Influencers Campaign",
          },
          { id: otherId, name: "Other shortlist" },
        ],
        "wavemaker-x-nbk-bank-summer-influencers-campaign",
        "d5170908",
        "name"
      ),
      shortlistId
    );
  });

  it("falls back to unique id-prefix match when slug text differs", () => {
    assert.equal(
      pickEntityIdBySlugMatch(
        [
          { id: shortlistId, name: "Different shortlist" },
          { id: otherId, name: "Other shortlist" },
        ],
        "wavemaker-x-nbk-bank-summer-influencers-campaign",
        "d5170908",
        "name"
      ),
      shortlistId
    );
  });

  it("accepts a unique id-prefix match when slug differs slightly", () => {
    assert.equal(
      pickEntityIdBySlugMatch(
        [
          { id: shortlistId, slug: "stored-slug", name: "Stored name" },
          { id: otherId, name: "Other shortlist" },
        ],
        "different-slug",
        "d5170908",
        "name"
      ),
      shortlistId
    );
  });

  it("matches by short id when slug text is stale after rename", () => {
    const renamedId = "fdd5a739-e5f6-4789-a012-3456789abcde";
    assert.equal(
      pickEntityIdBySlugMatch(
        [
          {
            id: renamedId,
            slug: "new-shortlist-name",
            name: "New shortlist name",
          },
          { id: otherId, name: "Other shortlist" },
        ],
        "live-event-coverage-influencer-engagement-formula-1",
        "fdd5a739",
        "name"
      ),
      renamedId
    );
  });
});
