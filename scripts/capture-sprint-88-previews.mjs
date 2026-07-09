/**
 * Sprint 8.8 — Generate presentation preview screenshots from mock campaign objects.
 * Validates section renderers without waiting for AI workflow completion.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "sprint-8.8");

const CAMPAIGNS = [
  {
    id: "babyjoy-egypt",
    label: "BabyJoy Egypt",
    brief:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
  },
  {
    id: "rolex-middle-east",
    label: "Rolex Middle East",
    brief:
      "Launch Rolex luxury watch collection across UAE and Saudi Arabia. Target affluent professionals 35–55. Budget AED 5,000,000. Duration 8 weeks. Objective: Brand prestige and aspiration.",
  },
  {
    id: "visit-egypt-tourism",
    label: "Visit Egypt Tourism",
    brief:
      "Visit Egypt tourism campaign promoting ancient wonders and Red Sea adventures. Target adventure travelers 25–40 across MENA. Budget USD 3,500,000. Duration 12 weeks.",
  },
  {
    id: "adidas-egypt",
    label: "Adidas Egypt",
    brief:
      "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo. Budget EGP 4,500,000. Duration 6 weeks.",
  },
  {
    id: "emirates-nbd",
    label: "Emirates NBD",
    brief:
      "Emirates NBD credit card product adoption campaign in UAE. Target young professionals 25–35. Budget AED 2,800,000. Duration 8 weeks.",
  },
];

async function buildPreviewHtml(campaign, modules) {
  const {
    parseCampaignSummary,
    resolveExecutiveStrategy,
    resolveBudgetData,
    resolveTimelineData,
    resolveKpiData,
    resolveRiskData,
    resolveCreativeConcepts,
    resolveContentPlan,
    resolveCreatorMix,
    resolveWhyAi,
    deriveDiscoveryPipeline,
  } = modules;

  const summary = parseCampaignSummary(campaign.brief);
  const strategy = resolveExecutiveStrategy(undefined, campaign.brief);
  const budget = resolveBudgetData(undefined, campaign.brief);
  const timeline = resolveTimelineData(undefined, campaign.brief);
  const kpis = resolveKpiData(undefined, campaign.brief);
  const risks = resolveRiskData(undefined, campaign.brief);
  const concepts = resolveCreativeConcepts(undefined, campaign.brief);
  const contentPlan = resolveContentPlan(undefined, campaign.brief);
  const creatorMix = resolveCreatorMix(undefined, campaign.brief);
  const whyAi = resolveWhyAi(undefined, campaign.brief);
  const pipeline = deriveDiscoveryPipeline(12, false);

  const card = (label, value) =>
    value
      ? `<div class="card"><div class="label">${label}</div><div class="value">${value}</div></div>`
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${campaign.label} — Campaign Studio</title>
<style>
  body { font-family: system-ui, sans-serif; background: #fafbff; padding: 24px; color: #111; }
  h1 { color: #1D9E75; }
  h2 { color: #7c3aed; margin-top: 24px; border-bottom: 2px solid #1D9E75; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: white; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
  .value { font-size: 13px; font-weight: 600; margin-top: 4px; }
  .pipeline { display: flex; gap: 8px; flex-wrap: wrap; }
  .stage { background: #1D9E7515; border: 1px solid #1D9E7540; border-radius: 999px; padding: 4px 10px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
  .concept { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: white; }
</style></head><body>
<h1>${campaign.label} — Campaign Studio Preview</h1>

<h2>Campaign Summary</h2>
<div class="grid">
  ${card("Client", summary.client)}
  ${card("Brand", summary.brand)}
  ${card("Product", summary.product)}
  ${card("Market", summary.market)}
  ${card("Objective", summary.objective)}
  ${card("Audience", summary.targetAudience)}
  ${card("Budget", summary.budget)}
  ${card("Duration", summary.duration)}
  ${card("Campaign Type", summary.campaignType)}
  ${card("Platforms", summary.platforms)}
  ${card("Creator Mix", summary.creatorMix)}
  ${card("Estimated Reach", summary.estimatedReach)}
</div>

<h2>Executive Strategy</h2>
<div class="grid">
  ${card("Business Challenge", strategy.businessChallenge)}
  ${card("Campaign Objective", strategy.objective)}
  ${card("Target Audience", strategy.targetAudience)}
  ${card("Consumer Insight", strategy.consumerInsight)}
  ${card("Key Message", strategy.keyMessage)}
  ${card("Creator Strategy", strategy.creatorStrategy)}
  ${card("Platform Strategy", strategy.platformStrategy)}
  ${card("Customer Journey", strategy.customerJourney)}
  ${card("Competitive Advantage", strategy.competitiveAdvantage)}
</div>

<h2>Vendor Discovery Pipeline</h2>
<div class="pipeline">${pipeline.map((s) => `<span class="stage">${s.label}: ${s.count}</span>`).join("")}</div>

<h2>Creative Concepts</h2>
<div class="grid">${concepts.map((c) => `<div class="concept"><strong>${c.name}</strong><br/>${c.bigIdea}<br/><em>${c.hook}</em><br/>CTA: ${c.cta}</div>`).join("")}</div>

<h2>Content Plan</h2>
<table><tr><th>Platform</th><th>Type</th><th>Tier</th><th>Qty</th><th>Week</th><th>Objective</th></tr>
${contentPlan.map((r) => `<tr><td>${r.platform}</td><td>${r.contentType}</td><td>${r.creatorTier}</td><td>${r.quantity}</td><td>${r.postingDate}</td><td>${r.objective}</td></tr>`).join("")}
</table>

<h2>Creator Mix</h2>
${creatorMix.map((t) => `<div class="card" style="margin-bottom:8px"><strong>${t.tier}</strong> — ${t.count} creators (${t.percent}%)<br/><span style="font-size:11px;color:#6b7280">${t.reasoning}</span></div>`).join("")}

<h2>Why AI</h2>
<div class="grid">${whyAi.map((w) => `<div class="card"><div class="label">${w.category}</div><div class="value">${w.title}</div><p style="font-size:11px;color:#6b7280;margin:4px 0 0">${w.rationale}</p></div>`).join("")}</div>

<h2>KPI Forecast</h2>
<div class="grid">${kpis?.kpis.map((k) => card(k.metric, k.target)).join("") ?? ""}</div>

<h2>Risk Analysis</h2>
${risks?.enrichedRisks?.map((r) => `<div class="card" style="margin-bottom:8px"><strong>${r.risk}</strong> [${r.severity}]<br/>Mitigation: ${r.mitigation}</div>`).join("") ?? ""}

<h2>Budget Planner</h2>
<div class="grid">${budget?.allocations.map((a) => card(a.category, `${a.percent}% — ${a.amount?.toLocaleString() ?? ""} ${budget.currency}`)).join("") ?? ""}</div>
<p style="font-size:11px;color:#6b7280">CPM: ${budget?.cpmAssumption ?? ""} | CPE: ${budget?.cpeAssumption ?? ""}</p>

<h2>Timeline (${timeline?.durationWeeks ?? ""} weeks)</h2>
<div class="grid">${timeline?.weeks.slice(0, 6).map((w) => card(`Week ${w.week}`, `${w.phase} — ${w.owner}`)).join("") ?? ""}</div>
</body></html>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const resolver = await import("../features/campaign-studio/services/section-data-resolver.ts");
  const { deriveDiscoveryPipeline } = await import(
    "../features/campaign-studio/services/presentation-intelligence.ts"
  );

  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 2400 });

  for (const campaign of CAMPAIGNS) {
    const campaignDir = path.join(OUT_DIR, campaign.id);
    fs.mkdirSync(campaignDir, { recursive: true });

    const html = await buildPreviewHtml(campaign, { ...resolver, deriveDiscoveryPipeline });
    const htmlPath = path.join(campaignDir, "preview.html");
    fs.writeFileSync(htmlPath, html);

    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0" });
    await page.screenshot({
      path: path.join(campaignDir, "campaign-studio-full.png"),
      fullPage: true,
    });

    console.log(`Screenshot: ${path.join(campaignDir, "campaign-studio-full.png")}`);
  }

  await browser.close();
  console.log(`\nAll screenshots saved to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
