import assert from "node:assert/strict";
import { test } from "node:test";

import { isEphemeralStoryDeliverableType } from "@/lib/campaigns/deliverable-taxonomy";
import {
  decideStoryLiveWrite,
  defaultStoryWentLiveDate,
  isStoryWorkflowLive,
  storyPostLabel,
} from "@/lib/campaigns/mark-stories-live-policy";
import { clientCampaignOpenHref } from "@/features/client-workspace/campaign-execution";

test("ephemeral story types include IG, FB, TikTok, and Snapchat stories", () => {
  assert.equal(isEphemeralStoryDeliverableType("instagram_story"), true);
  assert.equal(isEphemeralStoryDeliverableType("facebook_story"), true);
  assert.equal(isEphemeralStoryDeliverableType("tiktok_story"), true);
  assert.equal(isEphemeralStoryDeliverableType("snapchat_story"), true);
  assert.equal(isEphemeralStoryDeliverableType("instagram_reel"), false);
  assert.equal(isEphemeralStoryDeliverableType("instagram_highlight"), false);
});

test("story labels match assignment Story 1, 2 numbering", () => {
  assert.equal(storyPostLabel("instagram_story", 1), "Story 1");
  assert.equal(storyPostLabel("facebook_story", 2), "Story 2");
});

test("went-live date prefers the scheduled live-ad date", () => {
  assert.equal(defaultStoryWentLiveDate("2026-08-14", "2026-08-28"), "2026-08-14");
  assert.equal(defaultStoryWentLiveDate(null, "2026-08-28"), "2026-08-28");
  assert.equal(defaultStoryWentLiveDate("2026-08-14T18:00:00Z", "2026-08-28"), "2026-08-14");
});

test("posted stories are already live and do not insert a second publication", () => {
  assert.equal(isStoryWorkflowLive("posted"), true);
  assert.equal(isStoryWorkflowLive("draft"), false);
  const already = decideStoryLiveWrite({
    deliverableType: "instagram_story",
    postStatus: "posted",
    existingPublicationId: "pub-1",
  });
  assert.deepEqual(already, {
    eligible: true,
    markPosted: false,
    insertPublication: false,
  });

  const firstTime = decideStoryLiveWrite({
    deliverableType: "instagram_story",
    postStatus: "scheduled",
    existingPublicationId: null,
  });
  assert.deepEqual(firstTime, {
    eligible: true,
    markPosted: true,
    insertPublication: true,
  });

  const reel = decideStoryLiveWrite({
    deliverableType: "instagram_reel",
    postStatus: "scheduled",
    existingPublicationId: null,
  });
  assert.equal(reel.eligible, false);
});

test("client checkpoints open proof images and never dead story URLs", () => {
  assert.equal(
    clientCampaignOpenHref({
      proofImageUrl: "https://cdn.example/story.png",
      contentUrl: "https://www.instagram.com/stories/nadsmarkiz/3973767590195262618/",
      isStory: true,
    }),
    "https://cdn.example/story.png"
  );
  assert.equal(
    clientCampaignOpenHref({
      proofImageUrl: null,
      contentUrl: "https://www.instagram.com/stories/nadsmarkiz/3973767590195262618/",
      isStory: true,
    }),
    null
  );
  assert.equal(
    clientCampaignOpenHref({
      proofImageUrl: null,
      contentUrl: "https://www.instagram.com/reel/AbCdEf/",
      isStory: false,
    }),
    "https://www.instagram.com/reel/AbCdEf/"
  );
});
