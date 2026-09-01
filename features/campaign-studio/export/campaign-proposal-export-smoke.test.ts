import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import {
  prepareCampaignObjectForExport,
  serializeCampaignObject,
} from "@/features/campaign-intelligence";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import {
  buildCampaignProposalDocumentHtml,
  buildCampaignProposalModel,
  type ProposalVendor,
} from "@/features/campaign-studio/export/campaign-proposal-document";
import {
  embedProposalClientLogo,
  embedProposalExportAssets,
} from "@/features/campaign-studio/export/campaign-proposal-export-embed";
import { buildCampaignProposalPptxBuffer } from "@/features/campaign-studio/export/campaign-proposal-pptx";
import { resolveThinkwayReportLogoSrcsForExport } from "@/lib/reports/document/thinkway-report-logo-embed";

const CAMPAIGN_FACTS: CampaignFacts = {
  clientName: "BabyJoy",
  brandName: "BabyJoy Organic",
  objective: "Drive awareness for organic baby care among new parents",
  audience: "New parents aged 25–35 in the UAE",
  platforms: ["instagram", "tiktok"],
  geography: ["UAE"],
  campaignType: "awareness",
  budget: { amount: 165_000, currency: "AED" },
  durationWeeks: 6,
  rawBriefExcerpt: "BabyJoy organic baby care campaign",
  extractedAt: new Date().toISOString(),
  confidence: { objective: 0.92, budget: 0.9 },
  sources: { objective: "brief", budget: "brief" },
};

function buildStringifiedSnapshot() {
  const object = createEmptyCampaignObject({
    id: "11111111-1111-4111-8111-111111111111",
    conversationId: "conv-export-smoke",
    workflowId: "create-campaign",
  });

  object.meta.campaignFacts = CAMPAIGN_FACTS;
  object.meta.workflowStatus = "completed";
  object.sections.summary = {
    status: "complete",
    content:
      "Brand: BabyJoy Organic\nClient: BabyJoy\nObjective: Drive awareness for organic baby care\nAudience: New parents 25–35\nPlatforms: Instagram, TikTok\nBudget: AED 165,000\nDuration: 6 weeks",
    data: {},
  };
  object.sections.strategy = {
    status: "complete",
    content:
      "## Creator Strategy\nAuthentic parenting routines featuring organic baby care.\n### Key message\nTrust starts with gentle, natural ingredients.",
    data: {},
  };
  object.sections.budget = {
    status: "complete",
    content: JSON.stringify({
      currency: "AED",
      total: 165_000,
      allocations: [{ category: "Creator fees", percent: 100, amount: 165_000 }],
    }),
    data: {},
  };
  object.sections.creators = {
    status: "complete",
    content: "",
    data: {
      recommendations: {
        creatorIds: ["inf:creator-1", "inf:creator-2"],
        selectedReasoning: [
          {
            creatorId: "inf:creator-1",
            displayName: "Organic Mom",
            whySelected: "Strong fit for natural parenting content",
            expectedRole: "Macro",
            confidence: 0.9,
          },
          {
            creatorId: "inf:creator-2",
            displayName: "Baby First UAE",
            whySelected: "High engagement with UAE parent audience",
            expectedRole: "Mid",
            confidence: 0.86,
          },
        ],
      },
      recommendationsDisplay:
        "- Organic Mom @organicmom (Instagram)\n- Baby First UAE @babyfirst (TikTok)",
    },
  };
  object.sections.performance = {
    status: "complete",
    content: JSON.stringify({
      kpis: [
        { metric: "Reach", target: "2.1M", benchmark: "Industry median" },
        { metric: "Engagement rate", target: "4.5%", benchmark: "Category avg" },
      ],
    }),
    data: {},
  };
  object.sections.presentation = {
    status: "complete",
    content: "Campaign presentation ready for client review.",
    data: {
      completion: {
        sectionsComplete: 9,
        totalSections: 9,
        completionPercent: 100,
        version: "TW-2026-0042",
      },
    },
  };

  return serializeCampaignObject(object);
}

test("prepareCampaignObjectForExport enriches stringified snapshots for export resolvers", () => {
  const snapshot = buildStringifiedSnapshot();
  const prepared = prepareCampaignObjectForExport(snapshot);
  const model = buildCampaignProposalModel(prepared);

  assert.equal(model.client, "BabyJoy");
  assert.equal(model.brand, "BabyJoy Organic");
  assert.ok(model.understanding.some(([label]) => label === "Objective"));
  assert.ok(model.vendors.length >= 2);
  assert.ok(model.budget?.total === 165_000);
  assert.ok(model.kpis.length >= 2);
});

test("proposal HTML includes client, vendors, budget, and understanding fields", () => {
  const snapshot = buildStringifiedSnapshot();
  const prepared = prepareCampaignObjectForExport(snapshot);
  const html = buildCampaignProposalDocumentHtml(prepared);

  assert.match(html, /BabyJoy/);
  assert.match(html, /Organic Mom/);
  assert.match(html, /165,?000|165K|AED/i);
  assert.match(html, /Campaign Understanding/);
  assert.match(html, /Executive Planning Brief/);
  assert.match(html, /@media screen/);
  assert.match(html, /transform:scale\(calc\(100vw/);
});

test("buildCampaignProposalDocumentHtml embeds Thinkway logo data URIs for PDF export", () => {
  const snapshot = buildStringifiedSnapshot();
  const prepared = prepareCampaignObjectForExport(snapshot);
  const logoSrcs = resolveThinkwayReportLogoSrcsForExport();
  const html = buildCampaignProposalDocumentHtml(prepared, [], {}, { logoSrcs });

  assert.ok(logoSrcs.logoDarkSrc?.startsWith("data:image/png;base64,"));
  assert.ok(logoSrcs.logoLightSrc?.startsWith("data:image/png;base64,"));
  assert.ok(html.includes(logoSrcs.logoDarkSrc!));
  assert.ok(html.includes(logoSrcs.logoLightSrc!));
  assert.ok(!html.includes('src="/tw-logo-dark.png"'));
  assert.ok(!html.includes('src="/tw-logo-light.png"'));
});

test("buildCampaignProposalDocumentHtml inlines embedded client logo for PDF export", () => {
  const snapshot = buildStringifiedSnapshot();
  const prepared = prepareCampaignObjectForExport(snapshot);
  const clientLogoDataUri =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const remoteLogo = "https://cdn.example/e-and-logo.png";
  const html = buildCampaignProposalDocumentHtml(
    prepared,
    [],
    { clientLogoUrl: clientLogoDataUri },
    { logoSrcs: resolveThinkwayReportLogoSrcsForExport() }
  );

  assert.ok(html.includes('class="client-logo"'));
  assert.ok(html.includes(clientLogoDataUri));
  assert.ok(!html.includes(remoteLogo));
});

test("embedProposalClientLogo preserves existing data URIs", async () => {
  const dataUri =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const embedded = await embedProposalClientLogo(dataUri);
  assert.ok(embedded?.startsWith("data:image/"));
});

test("embedProposalExportAssets strips unfetchable remote avatar URLs for PDF", async () => {
  const vendors: ProposalVendor[] = [
    {
      displayName: "Organic Mom",
      avatarUrl: "https://cdn.example/avatar.jpg",
      tier: "Macro",
    },
  ];
  const embedded = await embedProposalExportAssets({ vendors });
  assert.equal(embedded.vendors[0]?.avatarUrl, undefined);
});

test("proposal PPTX embeds creator avatars from data URI and initial fallback", async () => {
  const snapshot = buildStringifiedSnapshot();
  const prepared = prepareCampaignObjectForExport(snapshot);
  /** 1×1 PNG */
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const vendors: ProposalVendor[] = [
    {
      displayName: "Organic Mom",
      handle: "organicmom",
      platform: "Instagram",
      followers: 120_000,
      engagementRate: 4.2,
      avatarUrl: tinyPng,
      tier: "Macro",
      contentIdea: "Morning routine with organic lotion",
    },
    {
      displayName: "Baby First UAE",
      handle: "babyfirst",
      platform: "TikTok",
      followers: 85_000,
      engagementRate: 5.1,
      tier: "Mid",
      contentIdea: "First-week essentials haul",
    },
  ];

  const buffer = await buildCampaignProposalPptxBuffer(prepared, vendors);
  assert.ok(buffer.length > 5_000, "PPTX buffer should be non-trivial");
  // PPTX is a ZIP archive
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4b);
});

test("proposal creator avatars embed original bytes; client logos still compress", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "campaign-proposal-export-embed.ts"),
    "utf8"
  );
  assert.match(source, /toUnprocessedImageDataUri/);
  assert.match(source, /CLIENT_LOGO_COMPRESS/);
  assert.doesNotMatch(source, /PROPOSAL_AVATAR_COMPRESS|toCompressedExportDataUri/);
});
