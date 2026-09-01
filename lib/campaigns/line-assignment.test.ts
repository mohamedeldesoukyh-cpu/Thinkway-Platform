import assert from "node:assert/strict";

import { buildLineTitle, suggestCostFromRateCard } from "@/lib/campaigns/line-assignment";

assert.equal(
  suggestCostFromRateCard({}, []),
  0,
  "no rate card must not invent a 500 placeholder cost"
);
assert.equal(
  suggestCostFromRateCard({ base_rate: 0 }, []),
  0
);
assert.equal(
  suggestCostFromRateCard({ default_fee: 1200 }, []),
  1200,
  "explicit rate-card fee is still returned"
);
assert.equal(
  suggestCostFromRateCard({ base_rate: 800 }, [
    {
      account_id: "11111111-1111-4111-8111-111111111111",
      platform: "instagram",
      handle: "ouda.5",
      profile_url: null,
      follower_count: 0,
      engagement_rate: null,
      audience_country: null,
      deliverables: [],
    },
  ]),
  800
);

assert.equal(buildLineTitle("Abdelrahman", []), "Abdelrahman");

console.log("line-assignment tests passed");
