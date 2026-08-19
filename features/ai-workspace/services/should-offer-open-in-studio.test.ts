import assert from "node:assert/strict";
import test from "node:test";

import { shouldOfferOpenInStudio } from "./should-offer-open-in-studio";

const OPERATIONAL_BRIEF = [
  "Launch Limitless Naturals in Egypt.",
  "Budget EGP 500000.",
  "Duration 8 weeks.",
  "Objective: awareness among mothers.",
].join(" ");

test("does not offer Studio when a studio message is already bound", () => {
  assert.equal(
    shouldOfferOpenInStudio({
      hasStudioMessage: true,
      lastUserMessage: OPERATIONAL_BRIEF,
      hasCampaignObject: true,
    }),
    false
  );
});

test("offers Studio for an operational brief that has not bound a studio message", () => {
  assert.equal(
    shouldOfferOpenInStudio({
      hasStudioMessage: false,
      lastUserMessage: OPERATIONAL_BRIEF,
    }),
    true
  );
});

test("offers Studio when a campaign object exists without a studio bind", () => {
  assert.equal(
    shouldOfferOpenInStudio({
      hasStudioMessage: false,
      lastUserMessage: "thanks",
      hasCampaignObject: true,
    }),
    true
  );
});

test("does not offer Studio for ordinary chat", () => {
  assert.equal(
    shouldOfferOpenInStudio({
      hasStudioMessage: false,
      lastUserMessage: "What is Thinkway?",
    }),
    false
  );
});
