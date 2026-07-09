import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { profileToDiscoveryRequirements } from "../discovery-campaign-requirements";
import { normalizeFromProfile } from "../normalization";
import { createEmptyCampaignIntelligenceProfile } from "../../types/profile";
import { parseStructuredBriefDocument } from "./index";
import {
  applyStructuredBriefFields,
  extractProfileFieldsFromStructuredBrief,
} from "./extract-profile-fields";

const PDF_PATH =
  "c:\\Users\\X13 Yoga G3\\Downloads\\Loreal_Premium_Skincare_Campaign_Brief.pdf";

async function main() {
  if (!existsSync(PDF_PATH)) {
    console.log("loreal-pdf.integration.test.ts — skipped (PDF not on this machine)");
    return;
  }

  const buf = readFileSync(PDF_PATH);
  const parsed = await parseStructuredBriefDocument(
    buf,
    "application/pdf",
    "Loreal_Premium_Skincare_Campaign_Brief.pdf"
  );
  const doc = parsed.document;

  const patch = extractProfileFieldsFromStructuredBrief(doc);
  assert.equal(patch.brandName, "L'Oréal Paris");
  assert.deepEqual(patch.platforms, ["instagram", "tiktok"]);
  assert.equal(patch.audienceDetail?.gender, "female");
  assert.equal(patch.audienceDetail?.ageMin, 25);
  assert.equal(patch.audienceDetail?.ageMax, 40);

  const enriched = applyStructuredBriefFields(createEmptyCampaignIntelligenceProfile(), doc);
  const { profile } = normalizeFromProfile(enriched);
  const req = profileToDiscoveryRequirements(profile);

  assert.equal(req.brandName, "L'Oréal Paris");
  assert.ok(req.platforms.includes("instagram"));
  assert.ok(req.platforms.includes("tiktok"));
  assert.equal(req.audienceGender, "female");
  assert.equal(req.followerMin, "20000");
  assert.equal(req.followerMax, "500000");

  console.log("loreal-pdf.integration.test.ts — passed", {
    brand: req.brandName,
    platforms: req.platforms,
    categories: req.categories,
    niches: req.creatorNiches,
    followers: `${req.followerMin}-${req.followerMax}`,
    gender: req.audienceGender,
    age: `${req.audienceAgeMin}-${req.audienceAgeMax}`,
    keywords: req.keywords,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
