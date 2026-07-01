import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseIndahashSearchExport, parseIndahashTabularRows, parseIndahashText } from "./indahash";

function buildIndahashNanoExport(count: number): string {
  const header = [
    "indaHash Creator List Export",
    "Campaign: Nano Influencers Jordan",
    "Relevance score based on audience fit",
    "",
    "Creators",
  ].join("\n");

  const rows = Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const followers = 1_000 + (n % 9_000);
    const er = (1.5 + (n % 40) / 10).toFixed(2);
    const relevance = 60 + (n % 35);
    return `@nano_creator_${n} Instagram ${followers} ${er}% Jordan Nano,Lifestyle ${relevance}`;
  });

  return `${header}\n${rows.join("\n")}`;
}

function testIndahashNanoCreatorCount() {
  const text = buildIndahashNanoExport(1823);
  const rows = parseIndahashText(text, "indaHash");

  assert.equal(rows.length, 1823, `expected 1823 creators, got ${rows.length}`);
  assert.equal(rows[0]?.username, "nano_creator_1");
  assert.equal(rows[0]?.platform, "instagram");
  assert.equal(rows[0]?.country, "Jordan");
  assert.deepEqual(rows[0]?.categories, ["Nano", "Lifestyle"]);
  assert.equal(rows[1822]?.username, "nano_creator_1823");
}

function testIndahashDeduplicatesHandles() {
  const text = [
    "@duplicate_user Instagram 1200 2.10% Jordan Fashion,Beauty 80",
    "@duplicate_user Instagram 1300 2.20% Jordan Fashion,Beauty 81",
  ].join("\n");

  const rows = parseIndahashText(text, "indaHash");
  assert.equal(rows.length, 1);
}

function testIndahashParsesCompactFollowers() {
  const text =
    "@mega_creator TikTok 12.5K 4.50% UAE Travel,Food 92";
  const rows = parseIndahashText(text, "indaHash");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.followers, 12_500);
  assert.equal(rows[0]?.engagement_rate, 4.5);
  assert.equal(rows[0]?.platform, "tiktok");
}

function testIndahashFixtureSample() {
  const fixturePath = path.join(
    import.meta.dirname,
    "..",
    "fixtures",
    "indahash-nano-sample.txt"
  );
  const text = readFileSync(fixturePath, "utf8");
  const rows = parseIndahashText(text, "indaHash");
  assert.equal(rows.length, 2);
}

// indaHash web "Creator Search" PDF export (flattened table, no "@" handles).
function testSearchExportParsesScatteredLayout() {
  const fixturePath = path.join(
    import.meta.dirname,
    "..",
    "fixtures",
    "indahash-search-export-sample.txt"
  );
  const text = readFileSync(fixturePath, "utf8");
  const rows = parseIndahashSearchExport(text, "indaHash");

  // 8 distinct handles in the fixture; the structured @-parser would find none.
  assert.equal(parseIndahashText(text, "indaHash").length, 0);
  assert.equal(rows.length, 8, `expected 8 creators, got ${rows.length}`);

  const byUser = new Map(rows.map((row) => [row.username, row]));

  // ER% appears before the relevance "100".
  const wafa = byUser.get("wafasyedofficial");
  assert.ok(wafa, "wafasyedofficial missing");
  assert.equal(wafa?.platform, "instagram");
  assert.equal(wafa?.followers, 1_200_000);
  assert.equal(wafa?.engagement_rate, 0.68);
  assert.equal(wafa?.relevance_score, 100);
  assert.equal(wafa?.country, "Egypt");

  // Audience-interest chips are recovered from the interleaved token stream and
  // mirrored into both categories and audience_interests.
  assert.deepEqual(wafa?.categories, [
    "Camera & Photography",
    "Restaurants, Food & Grocery",
    "Clothes, Shoes, Handbags & Accessories",
  ]);
  assert.deepEqual(wafa?.audience_interests, wafa?.categories);

  // Every parsed creator should carry at least one audience interest, and the
  // top filter chrome ("Category : Automotive", "Audience Interests", …) must
  // never leak into a creator's interest list.
  for (const row of rows) {
    assert.ok(
      row.categories.length > 0,
      `${row.username} has no audience interests`
    );
    for (const tag of row.categories) {
      assert.ok(
        !/^(audience|category|relevance|recent|select|type)\b/i.test(tag),
        `${row.username} leaked UI chrome chip: ${tag}`
      );
    }
  }

  // Relevance "100" appears before the ER%.
  const monica = byUser.get("monicamedhat__");
  assert.equal(monica?.followers, 1_100_000);
  assert.equal(monica?.engagement_rate, 0.82);
  assert.equal(monica?.relevance_score, 100);

  // Handle + all metrics on a single line, leading underscore handle.
  const tamany = byUser.get("_tamany_officiall");
  assert.equal(tamany?.followers, 1_200_000);
  assert.equal(tamany?.engagement_rate, 2.78);

  // Compact "k" followers.
  const farah = byUser.get("ittsfarahh");
  assert.equal(farah?.followers, 864_800);
  assert.equal(farah?.engagement_rate, 0.34);

  // Handle containing a dot.
  assert.ok(byUser.has("monaelshazly.official"));
}

function testSearchExportDeduplicatesHandles() {
  const text = [
    "wafasyedofficial Camera & Photography",
    "0.68% 100	1",
    "1.2M",
    "wafasyedofficial Camera & Photography",
    "0.70% 100	2",
    "1.3M",
  ].join("\n");
  const rows = parseIndahashSearchExport(text, "indaHash");
  assert.equal(rows.length, 1);
}

function testSearchExportIgnoresUiChrome() {
  const text = [
    "Campaign brief Upload file Use AI to find creators Filter Clear filters Sort : Relevance Search Search history",
    "20 Results	Select all Audience Interests Recent posts avg. ER Relevance",
  ].join("\n");
  assert.equal(parseIndahashSearchExport(text, "indaHash").length, 0);
}

function testTabularMultiPlatformRows() {
  const rows = parseIndahashTabularRows(
    {
      Username: "hoda_saleh",
      "Display Name": "Hoda Saleh Mohamed",
      Country: "Jordan",
      Platforms: "Instagram, TikTok",
      "Instagram Followers": "1200000",
      "TikTok Followers": "850000",
      "YouTube Followers": "",
      "Facebook Followers": "",
      "Total Followers": "2050000",
      "Avg. Engagement Rate": "1.25%",
      Categories: "Beauty,Fashion",
      "Audience Interests": "Camera & Photography; Restaurants, Food & Grocery",
      "Relevance Score": "92",
      Appearances: "3",
      Avatar: "",
    },
    "indaHash"
  );

  assert.equal(rows.length, 2);
  const instagram = rows.find((row) => row.platform === "instagram");
  const tiktok = rows.find((row) => row.platform === "tiktok");
  assert.ok(instagram);
  assert.ok(tiktok);
  assert.equal(instagram?.username, "hoda_saleh");
  assert.equal(instagram?.display_name, "Hoda Saleh Mohamed");
  assert.equal(instagram?.followers, 1_200_000);
  assert.equal(tiktok?.followers, 850_000);
  assert.equal(instagram?.engagement_rate, 1.25);
  assert.deepEqual(instagram?.categories, ["Beauty", "Fashion"]);
  assert.deepEqual(instagram?.audience_interests, [
    "Camera & Photography",
    "Restaurants, Food & Grocery",
  ]);
  assert.equal(instagram?.profile_picture_url, null);
  assert.equal(instagram?.appearances, 3);
}

function testTabularTotalFollowersFallbackSinglePlatform() {
  const rows = parseIndahashTabularRows(
    {
      Username: "solo_creator",
      Platform: "Instagram",
      Followers: "",
      "Total Followers": "2050000",
      "Avg. Engagement Rate": "1.25%",
    },
    "indaHash"
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.platform, "instagram");
  assert.equal(rows[0]?.followers, 2_050_000);
}

function testTabularTotalFollowersFallbackListedPlatformColumn() {
  const rows = parseIndahashTabularRows(
    {
      Username: "solo_creator",
      Platforms: "Instagram",
      "Instagram Followers": "",
      "Total Followers": "850000",
    },
    "indaHash"
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.followers, 850_000);
}

function testTabularTotalFollowersNotSplitAcrossMultiPlatform() {
  const rows = parseIndahashTabularRows(
    {
      Username: "multi_creator",
      Platforms: "Instagram, TikTok",
      "Instagram Followers": "",
      "TikTok Followers": "",
      "Total Followers": "3000000",
    },
    "indaHash"
  );

  assert.equal(rows.length, 2);
  assert.equal(rows.every((row) => row.followers == null), true);
}

function testTabularAudienceInterestsPreservesCommaPhrases() {
  const rows = parseIndahashTabularRows(
    {
      Username: "interest_creator",
      Platform: "Instagram",
      Followers: "1000",
      "Audience Interests": "Restaurants, Food & Grocery",
    },
    "indaHash"
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]?.audience_interests, ["Restaurants, Food & Grocery"]);
}

function testTabularAudienceInterestsSemicolonSeparated() {
  const rows = parseIndahashTabularRows(
    {
      Username: "interest_creator",
      Platform: "Instagram",
      Followers: "1000",
      "Audience Interests": "Camera & Photography; Restaurants, Food & Grocery",
    },
    "indaHash"
  );

  assert.deepEqual(rows[0]?.audience_interests, [
    "Camera & Photography",
    "Restaurants, Food & Grocery",
  ]);
}

function testTabularPreservesSeparateCategoriesAndInterests() {
  const rows = parseIndahashTabularRows(
    {
      Username: "creator_audience",
      Platform: "Instagram",
      Followers: "1000",
      Categories: "Beauty",
      "Audience Interests": "Camera & Photography",
    },
    "indaHash"
  );

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]?.categories, ["Beauty"]);
  assert.deepEqual(rows[0]?.audience_interests, ["Camera & Photography"]);
}

testIndahashNanoCreatorCount();
testIndahashDeduplicatesHandles();
testIndahashParsesCompactFollowers();
testIndahashFixtureSample();
testSearchExportParsesScatteredLayout();
testSearchExportDeduplicatesHandles();
testSearchExportIgnoresUiChrome();
testTabularMultiPlatformRows();
testTabularPreservesSeparateCategoriesAndInterests();
testTabularTotalFollowersFallbackSinglePlatform();
testTabularTotalFollowersFallbackListedPlatformColumn();
testTabularTotalFollowersNotSplitAcrossMultiPlatform();
testTabularAudienceInterestsPreservesCommaPhrases();
testTabularAudienceInterestsSemicolonSeparated();

console.log("lib/discovery-import/parsers/indahash.test.ts — all tests passed");
