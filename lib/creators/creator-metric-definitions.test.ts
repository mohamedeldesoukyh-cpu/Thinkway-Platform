import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREATOR_METRIC_DEFINITIONS,
  CREDIBILITY_SCORE_FEASIBILITY,
  publicationEngagements,
  resolveAvgEngagements,
  resolveAvgLikes,
  resolveAvgReelsPlays,
} from "./creator-metric-definitions";

test("definitions match product copy", () => {
  assert.equal(
    CREATOR_METRIC_DEFINITIONS.avg_engagements,
    "Average number of interactions (likes, comments, shares, saves etc) per one published post."
  );
  assert.equal(CREATOR_METRIC_DEFINITIONS.avg_likes, "Average number of likes per post.");
  assert.equal(
    CREATOR_METRIC_DEFINITIONS.avg_reels_plays,
    "The average sum of reels plays on the last 30 posts."
  );
});

test("publicationEngagements sums available interaction parts", () => {
  assert.equal(publicationEngagements({ likes: 10, comments: 2, shares: 1, saves: 3 }), 16);
  assert.equal(publicationEngagements({ likes: 5 }), 5);
  assert.equal(publicationEngagements({}), null);
});

test("resolveAvgEngagements averages posts then falls back to avgs", () => {
  assert.equal(
    resolveAvgEngagements({
      publications: [
        { likes: 10, comments: 2 },
        { likes: 20, comments: 4 },
      ],
    }),
    18
  );
  assert.equal(resolveAvgEngagements({ avgLikes: 100, avgComments: 5 }), 105);
  assert.equal(resolveAvgEngagements({}), null);
});

test("resolveAvgLikes averages likes per post", () => {
  assert.equal(
    resolveAvgLikes({
      publications: [{ likes: 10 }, { likes: 30 }, { likes: null }],
    }),
    20
  );
  assert.equal(resolveAvgLikes({ avgLikes: 42.6 }), 43);
});

test("resolveAvgReelsPlays averages video plays only", () => {
  assert.equal(
    resolveAvgReelsPlays({
      publications: [
        { views: 1000, isVideo: true },
        { views: 500, isVideo: false },
        { views: 3000, isVideo: true },
      ],
    }),
    2000
  );
  assert.equal(resolveAvgReelsPlays({ reelsViewsAvg: 1500.4 }), 1500);
  assert.equal(resolveAvgReelsPlays({ publications: [{ views: 9, isVideo: false }] }), null);
});

test("credibility score audience signals are not fully applicable", () => {
  assert.equal(CREDIBILITY_SCORE_FEASIBILITY.overallCredibilityScore.canApply, false);
  assert.equal(CREDIBILITY_SCORE_FEASIBILITY.audienceTypes.canApply, false);
  assert.equal(CREDIBILITY_SCORE_FEASIBILITY.audienceReachability.canApply, false);
});
