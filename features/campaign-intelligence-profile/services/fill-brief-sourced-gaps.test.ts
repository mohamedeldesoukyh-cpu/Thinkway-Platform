import assert from "node:assert/strict";
import test from "node:test";

import { fillBriefSourcedHeuristicGaps } from "./extract-profile-llm";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";

const ARAB_BANK_T1 = `
Hi Team,

Please note that Arab Bank is planning to launch an influencer campaign targeting Egyptians living in UAE during October–November.

Campaign Launch: October
Campaign Objective: for this campaign will use Egyptian influencers based in the UAE to communicate that Egyptians living in the UAE can open an account with Arab Bank Dubai, and also open an Arab Bank Egypt account directly from Dubai, making it easier to transfer money between the UAE and Egypt.
Budget: The campaign budget has not yet been finalized. Therefore, please share your recommendations and we will review the options and agree on the final selection.
`;

test("Arab Bank t1: fill brief-sourced gaps, never invent budget or platforms", () => {
  const sparseLlm = {
    ...createEmptyCampaignIntelligenceProfile(),
    brandName: "Arab Bank",
    platforms: ["instagram", "tiktok"],
    sources: { brandName: "brief" as const, platforms: "brief" as const },
  };

  const filled = fillBriefSourcedHeuristicGaps(sparseLlm, ARAB_BANK_T1);

  assert.equal(filled.brandName, "Arab Bank");
  assert.match(filled.objective ?? "", /Egyptian influencers based in the UAE/i);
  assert.ok((filled.geography ?? []).some((value) => /united arab emirates|uae|egypt/i.test(value)));
  assert.equal(filled.budget, undefined);
  assert.equal(filled.platforms, undefined);
});

test("chat brief Campaign: line fills campaignName without inventing platforms", () => {
  const brief = [
    "We have an upcoming campaign for Arab Bank new credit card instant issuance feature.",
    "Campaign: Credit Card Instant Issuance",
    "Duration: 1 month (TBA)",
    "The campaign is targeting a mass audience.",
    "The client has not shared a specific budget.",
  ].join("\n");

  const filled = fillBriefSourcedHeuristicGaps(createEmptyCampaignIntelligenceProfile(), brief);
  assert.equal(filled.brandName, "Arab Bank");
  assert.match(filled.campaignName ?? "", /credit card instant issuance/i);
  assert.equal(filled.budget, undefined);
  assert.equal(filled.platforms, undefined);
});
