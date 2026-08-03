import assert from "node:assert/strict";
import test from "node:test";

import {
  humanizeCreatorHandle,
  parseCompactFollowerCount,
  toBoardroomLanguage,
} from "./boardroom-language";

test("toBoardroomLanguage strips SSOT and CampaignFacts jargon", () => {
  const input =
    "Director approves strategy grounded in CampaignFacts and Director Strategy SSOT. Facts SSOT: EGP 500,000.";
  const out = toBoardroomLanguage(input);
  assert.equal(/SSOT|CampaignFacts/i.test(out), false);
  assert.match(out, /brief|approved strategy|EGP 500,000/i);
});

test("toBoardroomLanguage strips CampaignFacts bracket evidence refs", () => {
  const input =
    "Brand awareness: 90% confidence — CampaignFacts[brand=L'Oréal Paris, objective=Brand awareness, budget=EGP 750,000]";
  const out = toBoardroomLanguage(input);
  assert.equal(/CampaignFacts/i.test(out), false);
  assert.match(out, /brief evidence/i);
});

test("parseCompactFollowerCount handles K/M suffixes", () => {
  assert.equal(parseCompactFollowerCount("767.6K"), 767_600);
  assert.equal(parseCompactFollowerCount("10.0M"), 10_000_000);
  assert.equal(parseCompactFollowerCount("0"), undefined);
});

test("humanizeCreatorHandle formats handles for display", () => {
  assert.equal(humanizeCreatorHandle("@nourhanneeisa"), "Nourhanneeisa");
  assert.equal(humanizeCreatorHandle("islam.fawzy_"), "Islam Fawzy");
});
