import assert from "node:assert/strict";

import {
  addAgreedPlatform,
  addedValueCreatorPercent,
  applyPublicationValueScopes,
  buildAssignmentAgreedPlatformIndexFromAssignments,
  classifyPublicationValueScope,
  countAddedValueCreators,
  createEmptyAssignmentAgreedPlatformIndex,
  partitionPublicationsByValueScope,
  publicationValueScopeLabel,
  summarizePublicationValueGroup,
} from "@/lib/performance/publication-value-scope";

const lineId = "line-1";
const influencerId = "inf-1";

function indexWithInstagram() {
  const index = createEmptyAssignmentAgreedPlatformIndex();
  addAgreedPlatform(index, {
    campaignLineId: lineId,
    influencerId,
    platform: "instagram",
  });
  return index;
}

{
  const index = indexWithInstagram();
  assert.equal(
    classifyPublicationValueScope(
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "instagram" },
      index
    ),
    "agreed"
  );
  assert.equal(
    classifyPublicationValueScope(
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" },
      index
    ),
    "added_value"
  );
  assert.equal(
    classifyPublicationValueScope(
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "youtube" },
      index
    ),
    "added_value"
  );
}

{
  const index = indexWithInstagram();
  addAgreedPlatform(index, {
    campaignLineId: lineId,
    influencerId,
    platform: "tiktok",
  });
  assert.equal(
    classifyPublicationValueScope(
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" },
      index
    ),
    "agreed"
  );
}

{
  const index = createEmptyAssignmentAgreedPlatformIndex();
  addAgreedPlatform(index, {
    campaignLineId: lineId,
    influencerId,
    platform: "instagram",
  });
  const classified = applyPublicationValueScopes(
    [
      { id: "ig", campaign_line_id: lineId, influencer_id: influencerId, platform: "instagram" },
      { id: "tt", campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" },
    ],
    index
  );
  assert.equal(classified[0]?.value_scope, "agreed");
  assert.equal(classified[1]?.value_scope, "added_value");

  addAgreedPlatform(index, {
    campaignLineId: lineId,
    influencerId,
    platform: "TikTok",
  });
  const afterAdd = applyPublicationValueScopes(classified, index);
  assert.equal(afterAdd[1]?.value_scope, "agreed");

  const removed = createEmptyAssignmentAgreedPlatformIndex();
  addAgreedPlatform(removed, {
    campaignLineId: lineId,
    influencerId,
    platform: "instagram",
  });
  const afterRemove = applyPublicationValueScopes(afterAdd, removed);
  assert.equal(afterRemove[1]?.value_scope, "added_value");
}

{
  const empty = createEmptyAssignmentAgreedPlatformIndex();
  const classified = applyPublicationValueScopes(
    [{ campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" }],
    empty
  );
  assert.equal(classified[0]?.value_scope, "agreed");
}

{
  const index = createEmptyAssignmentAgreedPlatformIndex();
  addAgreedPlatform(index, {
    campaignLineId: lineId,
    influencerId,
    platform: "instagram",
  });
  assert.equal(
    classifyPublicationValueScope(
      { campaign_line_id: null, influencer_id: influencerId, platform: "instagram" },
      index
    ),
    "agreed"
  );
  assert.equal(
    classifyPublicationValueScope(
      { campaign_line_id: null, influencer_id: influencerId, platform: "facebook" },
      index
    ),
    "added_value"
  );
}

{
  const partitioned = partitionPublicationsByValueScope([
    { value_scope: "agreed" as const },
    { value_scope: "added_value" as const },
    {},
  ]);
  assert.equal(partitioned.agreed.length, 2);
  assert.equal(partitioned.addedValue.length, 1);
  assert.equal(publicationValueScopeLabel("added_value"), "Added value");
  assert.equal(publicationValueScopeLabel("agreed"), "Agreed");
}

{
  const summary = summarizePublicationValueGroup([
    { reach: 100, impressions: 200, views: 50, total_engagements: 10 },
    { reach: 20, impressions: null, views: 5, total_engagements: 3 },
  ]);
  assert.deepEqual(summary, {
    count: 2,
    reach: 120,
    impressions: 200,
    views: 55,
    engagements: 13,
  });
}

{
  const classified = applyPublicationValueScopes(
    [
      { id: "ig", campaign_line_id: lineId, influencer_id: influencerId, platform: "instagram" },
      { id: "tt", campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" },
    ],
    buildAssignmentAgreedPlatformIndexFromAssignments({
      hierarchyGroups: [
        {
          line: { id: lineId, influencer_id: influencerId },
          deliverables: [{ platform: "instagram" }],
        },
      ],
    })
  );
  assert.equal(classified[0]?.value_scope, "agreed");
  assert.equal(classified[1]?.value_scope, "added_value");

  const afterAdd = applyPublicationValueScopes(
    classified,
    buildAssignmentAgreedPlatformIndexFromAssignments({
      hierarchyGroups: [
        {
          line: { id: lineId, influencer_id: influencerId },
          deliverables: [{ platform: "instagram" }, { platform: "tiktok" }],
        },
      ],
    })
  );
  assert.equal(afterAdd[1]?.value_scope, "agreed");

  const afterRemove = applyPublicationValueScopes(
    afterAdd,
    buildAssignmentAgreedPlatformIndexFromAssignments({
      hierarchyGroups: [
        {
          line: { id: lineId, influencer_id: influencerId },
          deliverables: [{ platform: "instagram" }],
        },
      ],
    })
  );
  assert.equal(afterRemove[1]?.value_scope, "added_value");
}

{
  const classified = applyPublicationValueScopes(
    [{ campaign_line_id: lineId, influencer_id: influencerId, platform: "youtube" }],
    buildAssignmentAgreedPlatformIndexFromAssignments({
      hierarchyGroups: [
        {
          line: { id: lineId, influencer_id: influencerId },
          deliverables: [{ platform: "instagram", posts: [{ platform: "youtube" }] }],
        },
      ],
    })
  );
  assert.equal(classified[0]?.value_scope, "agreed");
}

{
  // Synthetic deliverables are ignored. With hierarchy present and no real
  // deliverables on the line, do not fall back to metadata — posts are AV
  // when the campaign still has other agreed platforms.
  const classified = applyPublicationValueScopes(
    [{ campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" }],
    buildAssignmentAgreedPlatformIndexFromAssignments({
      hierarchyGroups: [
        {
          line: { id: lineId, influencer_id: influencerId },
          deliverables: [{ platform: "tiktok", is_synthetic: true }],
        },
        {
          line: { id: "line-other", influencer_id: "inf-other" },
          deliverables: [{ platform: "instagram" }],
        },
      ],
      lines: [
        {
          id: lineId,
          influencer_id: influencerId,
          assignment: {
            influencer_id: influencerId,
            platforms: [{ platform: "instagram", deliverables: ["instagram_reel"] }],
          },
        },
      ],
    })
  );
  assert.equal(classified[0]?.value_scope, "added_value");
}

{
  const classified = applyPublicationValueScopes(
    [
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "instagram" },
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" },
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "youtube" },
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "facebook" },
    ],
    buildAssignmentAgreedPlatformIndexFromAssignments({
      lines: [
        {
          id: lineId,
          influencer_id: influencerId,
          assignment: {
            influencer_id: influencerId,
            platforms: [
              { platform: "instagram", deliverables: ["instagram_reel"] },
              { platform: "tiktok", deliverables: [] },
              { platform: "youtube", deliverables: [] },
              { platform: "facebook", deliverables: [] },
            ],
          },
        },
      ],
    })
  );
  assert.equal(classified[0]?.value_scope, "agreed");
  assert.equal(classified[1]?.value_scope, "added_value");
  assert.equal(classified[2]?.value_scope, "added_value");
  assert.equal(classified[3]?.value_scope, "added_value");
}

{
  // Removing all Assignments-grid deliverables must not fall back to stale
  // metadata platforms / commercial_rows — posts become Added value.
  const classified = applyPublicationValueScopes(
    [
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "instagram" },
      { campaign_line_id: lineId, influencer_id: influencerId, platform: "tiktok" },
    ],
    buildAssignmentAgreedPlatformIndexFromAssignments({
      hierarchyGroups: [
        {
          line: { id: lineId, influencer_id: influencerId },
          deliverables: [],
        },
        {
          line: { id: "line-other", influencer_id: "inf-other" },
          deliverables: [{ platform: "instagram" }],
        },
      ],
      lines: [
        {
          id: lineId,
          influencer_id: influencerId,
          assignment: {
            influencer_id: influencerId,
            platforms: [
              { platform: "instagram", deliverables: ["instagram_reel"] },
              { platform: "tiktok", deliverables: ["tiktok_video"] },
            ],
            commercial_rows: [{ platform: "instagram" }, { platform: "tiktok" }],
          },
        },
      ],
    })
  );
  assert.equal(classified[0]?.value_scope, "added_value");
  assert.equal(classified[1]?.value_scope, "added_value");
}

{
  assert.equal(
    countAddedValueCreators([
      { value_scope: "agreed", influencer_id: "a" },
      { value_scope: "added_value", influencer_id: "b" },
      { value_scope: "added_value", influencer_id: "b" },
      { value_scope: "added_value", influencer_id: "c" },
      { value_scope: "agreed", influencer_id: "d" },
    ]),
    2
  );
  assert.equal(addedValueCreatorPercent(3, 30), 10);
  assert.equal(addedValueCreatorPercent(0, 30), null);
  assert.equal(addedValueCreatorPercent(1, 0), null);
}

console.log("publication-value-scope tests passed");
