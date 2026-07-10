import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  buildCampaignProposalModel,
  type CampaignProposalModel,
  type ProposalBranding,
  type ProposalVendor,
} from "./campaign-proposal-document";

/** CIO/VIO document palette (hex without # — pptxgenjs convention). */
const INK = "1A1F36";
const NAVY = "0A0F1E";
const GREEN = "1D9E75";
const MUTED = "6B7280";
const CARD = "F8FAFC";
const RULE = "E2E8F0";
const WHITE = "FFFFFF";

const TIER_FILL: Record<string, string> = {
  celebrity: "D97706",
  mega: "D97706",
  macro: "6366F1",
  "mid-tier": "1D9E75",
  mid: "1D9E75",
  micro: "8B5CF6",
  nano: "0284C7",
};

function tierFill(tier?: string): string {
  const key = (tier ?? "").trim().toLowerCase();
  for (const [prefix, fill] of Object.entries(TIER_FILL)) {
    if (key.startsWith(prefix)) return fill;
  }
  return "94A3B8";
}

type Slide = ReturnType<InstanceType<typeof import("pptxgenjs").default>["addSlide"]>;

function addSectionTitle(slide: Slide, sticker: string, title: string): void {
  slide.addText(`${sticker}  ${title}`, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.5,
    fontFace: "Inter",
    fontSize: 20,
    bold: true,
    color: INK,
  });
  slide.addShape("rect", { x: 0.5, y: 0.92, w: 0.6, h: 0.045, fill: { color: GREEN } });
}

/** Build the client proposal as a PowerPoint deck from the shared model. */
export async function buildCampaignProposalPptxBuffer(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = [],
  branding: ProposalBranding = {}
): Promise<Buffer> {
  const model: CampaignProposalModel = buildCampaignProposalModel(
    campaignObject,
    hydratedVendors,
    branding
  );

  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 10, height: 5.625 });
  pptx.layout = "WIDE";
  pptx.author = "Thinkway Platform";
  pptx.company = "Thinkway";
  pptx.title = model.campaignName;

  // ---- Cover ----
  const cover = pptx.addSlide();
  cover.background = { color: NAVY };
  cover.addText("THINKWAY · CAMPAIGN INTELLIGENCE PROPOSAL", {
    x: 0.5, y: 0.5, w: 9, h: 0.4,
    fontFace: "Inter", fontSize: 12, bold: true, color: GREEN, charSpacing: 3,
  });
  cover.addText(model.campaignName, {
    x: 0.5, y: 1.6, w: 9, h: 1.2,
    fontFace: "Inter", fontSize: 34, bold: true, color: WHITE,
  });
  if (model.objective) {
    cover.addText(model.objective, {
      x: 0.5, y: 2.9, w: 8.4, h: 1.0,
      fontFace: "Inter", fontSize: 14, color: WHITE, transparency: 8,
    });
  }
  cover.addText(`Prepared for ${model.client} · ${model.generated}`, {
    x: 0.5, y: 4.4, w: 8, h: 0.4, fontFace: "Inter", fontSize: 11, color: WHITE, transparency: 25,
  });
  cover.addText("Confidential — for client review only", {
    x: 0.5, y: 5.05, w: 8, h: 0.35, fontFace: "Inter", fontSize: 9, color: WHITE, transparency: 40,
  });

  // ---- Campaign Understanding + stat tiles ----
  const understanding = pptx.addSlide();
  addSectionTitle(understanding, "🎯", "Campaign Understanding");

  model.statTiles.slice(0, 4).forEach((tile, i) => {
    const x = 0.5 + i * 2.35;
    understanding.addShape("roundRect", {
      x, y: 1.1, w: 2.2, h: 1.05, fill: { color: CARD }, line: { color: RULE, width: 1 }, rectRadius: 0.06,
    });
    understanding.addShape("rect", { x, y: 1.1, w: 0.05, h: 1.05, fill: { color: GREEN } });
    understanding.addText(tile.label.toUpperCase(), {
      x: x + 0.12, y: 1.16, w: 2, h: 0.28, fontFace: "Inter", fontSize: 8.5, bold: true, color: MUTED, charSpacing: 1.5,
    });
    understanding.addText(tile.value, {
      x: x + 0.12, y: 1.4, w: 2, h: 0.45, fontFace: "Inter", fontSize: 18, bold: true, color: INK,
    });
    understanding.addText(tile.sub, {
      x: x + 0.12, y: 1.83, w: 2, h: 0.26, fontFace: "Inter", fontSize: 8.5, color: MUTED,
    });
  });

  const factRows = model.understanding.map(([label, value]) => [
    { text: label, options: { bold: true, color: MUTED, fontSize: 9.5 } },
    { text: value, options: { color: INK, fontSize: 10 } },
  ]);
  if (factRows.length > 0) {
    understanding.addTable(factRows as never, {
      x: 0.5, y: 2.4, w: 9, colW: [1.6, 7.4],
      fontFace: "Inter", border: { type: "solid", color: RULE, pt: 0.5 },
      autoPage: false, rowH: 0.32, valign: "top",
    });
  }

  // ---- Strategy & Executive Summary ----
  const strategySlide = pptx.addSlide();
  addSectionTitle(strategySlide, "🧭", "Strategy");
  strategySlide.addText(model.executiveSummary, {
    x: 0.5, y: 1.15, w: 9, h: 1.0, fontFace: "Inter", fontSize: 13, color: INK,
  });
  strategySlide.addText(model.strategyText, {
    x: 0.5, y: 2.3, w: 9, h: 1.4, fontFace: "Inter", fontSize: 11.5, color: MUTED,
  });
  if (model.recommendedActions.length > 0) {
    strategySlide.addText(
      model.recommendedActions.map((a) => ({ text: a, options: { bullet: true, breakLine: true } })),
      { x: 0.5, y: 3.8, w: 9, h: 1.5, fontFace: "Inter", fontSize: 10.5, color: INK }
    );
  }

  // ---- Momentum waves ----
  if (model.waves.length > 0) {
    const wavesSlide = pptx.addSlide();
    addSectionTitle(wavesSlide, "🚀", "Activation Plan — Momentum Waves");
    model.waves.slice(0, 6).forEach((wave, i) => {
      const y = 1.2 + i * 0.72;
      wavesSlide.addShape("ellipse", {
        x: 0.5, y: y + 0.04, w: 0.4, h: 0.4, fill: { color: tierFill(wave.tier) },
      });
      wavesSlide.addText(String(i + 1), {
        x: 0.5, y: y + 0.04, w: 0.4, h: 0.4, align: "center", fontFace: "Inter", fontSize: 12, bold: true, color: WHITE,
      });
      wavesSlide.addText(
        [
          { text: `${wave.window} — `, options: { bold: true, color: MUTED, fontSize: 9.5 } },
          { text: wave.wave, options: { bold: true, color: INK, fontSize: 11.5 } },
          { text: `\n${wave.goal}`, options: { color: MUTED, fontSize: 9.5 } },
        ],
        { x: 1.05, y, w: 8.4, h: 0.68, fontFace: "Inter", valign: "top" }
      );
    });
  }

  // ---- Creators (chunked table slides) ----
  const perSlide = 6;
  for (let start = 0; start < Math.max(model.vendors.length, 1); start += perSlide) {
    const slideVendors = model.vendors.slice(start, start + perSlide);
    const creatorsSlide = pptx.addSlide();
    addSectionTitle(
      creatorsSlide,
      "👥",
      `Recommended Creators${model.vendors.length > perSlide ? ` (${start + 1}–${Math.min(start + perSlide, model.vendors.length)})` : ""}`
    );

    if (start === 0 && model.mixSource.length > 0) {
      let x = 0.5;
      const totalPercent = model.mixSource.reduce((sum, m) => sum + m.percent, 0) || 100;
      for (const m of model.mixSource) {
        const w = Math.max((m.percent / totalPercent) * 9, 0.5);
        creatorsSlide.addShape("rect", { x, y: 1.12, w: w - 0.03, h: 0.22, fill: { color: tierFill(m.tier) } });
        x += w;
      }
      creatorsSlide.addText(
        model.mixSource.map((m) => `${m.tier} · ${m.count} · ${m.percent}%`).join("      "),
        { x: 0.5, y: 1.38, w: 9, h: 0.3, fontFace: "Inter", fontSize: 9, color: MUTED }
      );
    }

    const header = ["Creator", "Tier", "Platform", "Followers", "Why selected", "Content concept"].map(
      (t) => ({ text: t, options: { bold: true, color: MUTED, fontSize: 8.5, fill: { color: CARD } } })
    );
    const rows = slideVendors.map((v) => [
      { text: `${v.displayName}${v.handle ? `\n@${v.handle.replace(/^@/, "")}` : ""}`, options: { bold: true, color: INK, fontSize: 9.5 } },
      { text: v.tier ?? "—", options: { color: tierFill(v.tier), bold: true, fontSize: 9 } },
      { text: v.platform ?? "—", options: { color: INK, fontSize: 9 } },
      { text: v.followers != null ? v.followers.toLocaleString() : "—", options: { color: INK, fontSize: 9 } },
      { text: v.reason ?? "", options: { color: MUTED, fontSize: 8.5 } },
      { text: v.contentIdea ?? "", options: { color: MUTED, fontSize: 8.5 } },
    ]);
    creatorsSlide.addTable([header, ...rows] as never, {
      x: 0.5, y: start === 0 && model.mixSource.length > 0 ? 1.75 : 1.15,
      w: 9, colW: [1.7, 0.9, 0.9, 1.0, 2.25, 2.25],
      fontFace: "Inter", border: { type: "solid", color: RULE, pt: 0.5 },
      autoPage: false, valign: "top",
    });
  }

  // ---- Budget + amplification ----
  const budgetSlide = pptx.addSlide();
  addSectionTitle(budgetSlide, "💰", "Budget & Amplification");
  if (model.budget) {
    const single = model.budget.allocations.length <= 1;
    if (single) {
      budgetSlide.addText("100%", {
        x: 0.5, y: 1.2, w: 1.8, h: 0.8, fontFace: "Inter", fontSize: 34, bold: true, color: GREEN,
      });
      budgetSlide.addText(
        `${model.budget.allocations[0]?.category ?? "Creator fees"} — ${model.budget.currency} ${model.budget.total?.toLocaleString() ?? "—"}\n${model.budget.allocations[0]?.notes ?? "Influencer campaign model: production embedded in creator fees."}`,
        { x: 2.4, y: 1.2, w: 7.1, h: 0.9, fontFace: "Inter", fontSize: 10.5, color: INK, valign: "top" }
      );
    } else {
      model.budget.allocations.slice(0, 6).forEach((a, i) => {
        const y = 1.15 + i * 0.42;
        budgetSlide.addText(`${a.category} · ${a.percent ?? 0}%`, {
          x: 0.5, y, w: 3.2, h: 0.35, fontFace: "Inter", fontSize: 10, bold: true, color: INK,
        });
        budgetSlide.addShape("rect", { x: 3.8, y: y + 0.08, w: 5.2, h: 0.18, fill: { color: RULE } });
        budgetSlide.addShape("rect", {
          x: 3.8, y: y + 0.08, w: Math.max(((a.percent ?? 0) / 100) * 5.2, 0.05), h: 0.18, fill: { color: GREEN },
        });
      });
    }
  }
  budgetSlide.addText(
    model.amplification.map(([icon, item]) => ({
      text: `${icon}  ${item}`,
      options: { breakLine: true, fontSize: 10 },
    })),
    { x: 0.5, y: 2.6, w: 9, h: 2.6, fontFace: "Inter", color: INK, valign: "top" }
  );

  // ---- Success metrics ----
  if (model.kpis.length > 0) {
    const kpiSlide = pptx.addSlide();
    addSectionTitle(kpiSlide, "📈", "Success Metrics");
    const kpiHeader = ["Metric", "Target", "Basis"].map((t) => ({
      text: t, options: { bold: true, color: MUTED, fontSize: 9, fill: { color: CARD } },
    }));
    const kpiRows = model.kpis.map((k) => [
      { text: k.metric, options: { bold: true, color: INK, fontSize: 10 } },
      { text: k.target, options: { color: INK, fontSize: 10 } },
      { text: k.basis, options: { color: MUTED, fontSize: 9 } },
    ]);
    kpiSlide.addTable([kpiHeader, ...kpiRows] as never, {
      x: 0.5, y: 1.15, w: 9, colW: [3, 3, 3],
      fontFace: "Inter", border: { type: "solid", color: RULE, pt: 0.5 }, autoPage: false, valign: "top",
    });
    kpiSlide.addText(`Generated by Thinkway Platform · ${model.generated} · Ref ${model.presentationVersion}`, {
      x: 0.5, y: 5.1, w: 9, h: 0.3, fontFace: "Inter", fontSize: 8, color: MUTED,
    });
  }

  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return output;
}
