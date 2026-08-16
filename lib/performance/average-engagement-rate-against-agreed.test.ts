import assert from "node:assert/strict";

import { averageEngagementRateAgainstAgreed } from "@/lib/performance/engagement-rate-engine";

{
  // sum(all ERs) / agreed n — added value included in numerator only
  const avg = averageEngagementRateAgainstAgreed([1, 2, 3, 4], 2);
  assert.equal(avg, 5); // (1+2+3+4)/2
}

{
  assert.equal(averageEngagementRateAgainstAgreed([1.5, 2.5], 2), 2);
  assert.equal(averageEngagementRateAgainstAgreed([null, 4, undefined], 1), 4);
  assert.equal(averageEngagementRateAgainstAgreed([1, 2], 0), null);
  assert.equal(averageEngagementRateAgainstAgreed([], 5), null);
  assert.equal(averageEngagementRateAgainstAgreed([null, undefined], 3), null);
}

console.log("averageEngagementRateAgainstAgreed tests passed");
