import assert from "node:assert/strict";

import {
  formatBuildCampaignOutput,
  formatToolOutput,
  SUPPORTED_TOOL_NAMES,
} from "./tool-output-formatter";

// --- buildCampaign: canonical nested draft shape ---
{
  const result = formatToolOutput("buildCampaign", {
    draft: {
      brandId: "brand_1",
      name: "BabyJoy Launch",
      suggestedLines: [
        { code: "TW-2026-0001-A", creatorId: "cr_1", poAmount: 15000 },
        { code: "TW-2026-0001-B", creatorId: "cr_2" },
      ],
    },
  });
  assert.match(result, /BabyJoy Launch/);
  assert.match(result, /TW-2026-0001-A/);
  assert.match(result, /PO: 15000/);
}

// --- buildCampaign: flat legacy shape (validate-workflows test data) ---
{
  const result = formatToolOutput("buildCampaign", {
    name: "BabyJoy Launch",
    description: "Q3 influencer launch campaign.",
  });
  assert.match(result, /BabyJoy Launch/);
  assert.match(result, /Q3 influencer launch/);
}

// --- buildCampaign: nested draft with name only (approval auto-continue fixture) ---
{
  const result = formatToolOutput("buildCampaign", { draft: { name: "Test" } });
  assert.match(result, /\*\*Test\*\*/);
}

// --- buildCampaign: always returns — never empty ---
{
  assert.equal(formatBuildCampaignOutput({ foo: "bar" }), "Campaign draft (details pending approval)");
  assert.equal(formatBuildCampaignOutput(null), "Campaign draft (no details available)");
  assert.equal(formatBuildCampaignOutput(""), "Campaign draft (no details available)");
}

// --- buildCampaign: no recursion on prepare-approval taskId (taskId removed from API) ---
{
  const result = formatToolOutput("buildCampaign", { foo: "bar" });
  assert.equal(result, "Campaign draft (details pending approval)");
}

// --- searchCreators ---
{
  const result = formatToolOutput("searchCreators", {
    creators: [
      {
        id: "1",
        handle: "parentpro",
        displayName: "ParentPro",
        platform: "Instagram",
        followers: 120000,
      },
    ],
    total: 1,
  });
  assert.match(result, /ParentPro/);
}

// --- generateBrief: schema sections ---
{
  const result = formatToolOutput("generateBrief", {
    title: "Creative Brief",
    sections: [
      { heading: "Objectives", content: "Drive awareness among new parents." },
      { heading: "Deliverables", content: "2 Reels, 1 Story series." },
    ],
  });
  assert.match(result, /Creative Brief/);
  assert.match(result, /Objectives/);
  assert.match(result, /Deliverables/);
}

// --- generateReport ---
{
  const result = formatToolOutput("generateReport", {
    title: "Performance Report",
    summary: "Campaign is on track.",
    metrics: [{ label: "Reach", value: "2.4M" }],
    recommendations: ["Increase Reels allocation."],
  });
  assert.match(result, /Performance Report/);
  assert.match(result, /on track/);
  assert.match(result, /Reach/);
  assert.match(result, /Increase Reels/);
}

// --- read-only lookup tools ---
{
  assert.match(
    formatToolOutput("getCampaign", { name: "BabyJoy", code: "TW-2026-0001", status: "active" }),
    /BabyJoy/
  );
  assert.match(formatToolOutput("getClient", { name: "P&G Egypt" }), /P&G Egypt/);
  assert.match(
    formatToolOutput("getCreator", { displayName: "Creator X", platform: "instagram" }),
    /Creator X/
  );
  assert.match(formatToolOutput("getShortlist", { name: "Top Picks", creatorCount: 5 }), /Top Picks/);
}

// --- createShortlist ---
{
  assert.match(
    formatToolOutput("createShortlist", { name: "Egypt Moms", creatorCount: 8, status: "draft" }),
    /Egypt Moms/
  );
}

// --- string passthrough ---
{
  assert.equal(formatToolOutput("searchCreators", "  Found 10 creators  "), "Found 10 creators");
}

// --- unsupported tool ---
{
  assert.equal(formatToolOutput("unknownTool", { data: 1 }), "Unsupported tool");
}

// --- supported tools list is exhaustive ---
{
  assert.equal(SUPPORTED_TOOL_NAMES.length, 9);
  for (const tool of SUPPORTED_TOOL_NAMES) {
    assert.doesNotThrow(() => formatToolOutput(tool, null));
  }
}

console.log("tool-output-formatter tests passed");
