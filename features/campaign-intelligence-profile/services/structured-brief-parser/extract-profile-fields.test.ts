import assert from "node:assert/strict";

import { profileToDiscoveryRequirements } from "../discovery-campaign-requirements";
import { normalizeFromProfile } from "../normalization";
import {
  applyStructuredBriefFields,
  extractProfileFieldsFromStructuredBrief,
} from "./extract-profile-fields";
import { parsePlainTextStructured } from "./parse-text";
import { createEmptyCampaignIntelligenceProfile } from "../../types/profile";

const LOREAL_TEXT = `
L'Oréal Premium Skincare Campaign Brief

Client / Brand Name : L'Oréal Paris
Market : Egypt
Campaign Name : Vitamin C Serum Launch
Campaign Country : Egypt
Campaign Duration : 5 weeks
Campaign Objectives : Engagement, UGC, Brand awareness
Social Platforms : Instagram, TikTok
Creator Type Preferences : Beauty, skincare specialists, micro-influencers, 20k-500k followers
Audience Preferences : Women 25-40 interested in premium skincare
Content Keywords : vitamin c, serum, brightening, anti-aging
Deliverables : Reels, Stories, UGC posts
Budget : EUR 600,000
KPIs : Engagement rate 3%, Reach 2M
`.trim();

const document = parsePlainTextStructured(LOREAL_TEXT, "pdf", "pdf_text");
const patch = extractProfileFieldsFromStructuredBrief(document);

assert.equal(patch.brandName, "L'Oréal Paris", "structured patch must include brand");
assert.equal(patch.market, "Egypt");
assert.deepEqual(patch.platforms, ["instagram", "tiktok"]);

const enriched = applyStructuredBriefFields(createEmptyCampaignIntelligenceProfile(), document);
const { profile } = normalizeFromProfile(enriched);
const req = profileToDiscoveryRequirements(profile);

assert.equal(req.brandName, "L'Oréal Paris", "validated requirements must include brand");
assert.equal(req.marketCountry, "EG");
assert.ok(req.platforms.includes("instagram"));
assert.ok(req.keywords.length > 0 || req.creatorNiches.length > 0);

const LOREAL_PDF_SECTIONS = `
L'Oréal Premium Skincare Campaign Brief

Campaign Brief
Campaign: Premium Skincare Influencer Campaign
Brand: L'Oréal Paris
Market: Egypt
Duration: 6 Weeks

Objective
Drive awareness and purchase consideration for Revitalift Clinical Vitamin C Serum among Egyptian women through trusted beauty creators.

Target Audience
Gender: Female
Age: 25–40
Location: Egypt
Interests: Skincare, Beauty, Self-care, Dermatology, Luxury Beauty

Creator Requirements
Platforms: Instagram & TikTok
Categories: Beauty, Skincare, Dermatologists, Luxury Lifestyle
Followers: 20,000–500,000
Minimum Engagement Rate: 3%
Content: Educational, authentic, premium visuals
`.trim();

const pdfDocument = parsePlainTextStructured(LOREAL_PDF_SECTIONS, "pdf", "pdf_text");
const pdfPatch = extractProfileFieldsFromStructuredBrief(pdfDocument);

assert.equal(pdfPatch.brandName, "L'Oréal Paris", "PDF brief brand row");
assert.deepEqual(pdfPatch.platforms, ["instagram", "tiktok"], "PDF platforms split on &");
assert.equal(pdfPatch.audienceDetail?.gender, "female");
assert.equal(pdfPatch.audienceDetail?.ageMin, 25);
assert.equal(pdfPatch.audienceDetail?.ageMax, 40);
assert.ok(
  pdfPatch.creatorCategories?.some((c) => /beauty/i.test(c)),
  "PDF categories include Beauty"
);
assert.ok(
  pdfPatch.creatorCategories?.some((c) => /20000.*500000|20,?000/i.test(c)),
  "PDF follower range in creator categories"
);

const pdfEnriched = applyStructuredBriefFields(createEmptyCampaignIntelligenceProfile(), pdfDocument);
const { profile: pdfProfile } = normalizeFromProfile(pdfEnriched);
const pdfReq = profileToDiscoveryRequirements(pdfProfile);

assert.equal(pdfReq.brandName, "L'Oréal Paris");
assert.ok(pdfReq.platforms.includes("instagram"));
assert.ok(pdfReq.platforms.includes("tiktok"));
assert.equal(pdfReq.audienceGender, "female");
assert.equal(pdfReq.audienceAgeMin, "25");
assert.equal(pdfReq.audienceAgeMax, "40");

console.log("extract-profile-fields.test.ts — passed", {
  brand: req.brandName,
  market: req.marketCountry,
  platforms: req.platforms,
  keywords: req.keywords.length,
  pdfPlatforms: pdfReq.platforms,
  pdfGender: pdfReq.audienceGender,
  pdfCategories: pdfReq.categories,
});
