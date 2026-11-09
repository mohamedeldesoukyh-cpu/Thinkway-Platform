import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuotationProfileLinks, quotationCreatorIdentityKeys } from "./quotation-profile-links";

test("extracts links from prose and deduplicates normalized identities", () => {
  const result = parseQuotationProfileLinks("Creators for review:\nJane: https://www.instagram.com/jane.doe/\nAgain https://instagram.com/jane.doe/?utm_source=copy\nTikTok https://www.tiktok.com/@jane Thanks!");
  assert.equal(result.profiles.length, 2);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.invalid, []);
});

test("rejects post URLs and unrelated URLs without treating prose as invalid links", () => {
  const result = parseQuotationProfileLinks("See this post https://instagram.com/p/ABC/ and https://example.com/list, thanks");
  assert.equal(result.profiles.length, 0);
  assert.equal(result.invalid.length, 2);
});

test("normalizes quotation identity across URLs and references", () => {
  const existing = new Set(quotationCreatorIdentityKeys({ influencer_id: "one", profile_url: "https://instagram.com/jane/" }));
  assert(quotationCreatorIdentityKeys({ unified_id: "inf:one" }).some(key => existing.has(key)));
  assert(quotationCreatorIdentityKeys({ profile_url: "https://www.instagram.com/jane/?utm_source=copy" }).some(key => existing.has(key)));
  assert(!quotationCreatorIdentityKeys({ influencer_id: "two" }).some(key => existing.has(key)));
});
