/**
 * Sprint 8.9 — Generate grounded presentation preview screenshots.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "sprint-8.9");

const CAMPAIGNS = [
  { id: "babyjoy-egypt", label: "BabyJoy Egypt", brief: "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC." },
  { id: "rolex-middle-east", label: "Rolex Middle East", brief: "Launch Rolex luxury watch collection across UAE and Saudi Arabia. Target affluent professionals 35–55. Budget AED 5,000,000. Duration 8 weeks. Objective: Brand prestige and aspiration." },
  { id: "visit-egypt-tourism", label: "Visit Egypt Tourism", brief: "Visit Egypt tourism campaign promoting ancient wonders and Red Sea adventures. Target adventure travelers 25–40 across MENA. Budget USD 3,500,000. Duration 12 weeks." },
  { id: "adidas-egypt", label: "Adidas Egypt", brief: "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo. Budget EGP 4,500,000. Duration 6 weeks." },
  { id: "emirates-nbd", label: "Emirates NBD", brief: "Emirates NBD credit card product adoption campaign in UAE. Target young professionals 25–35. Budget AED 2,800,000. Duration 8 weeks." },
];

async function buildPreviewHtml(campaign, modules) {
  const {
    resolveGroundedStrategyFields,
    resolveBudgetData,
    resolveGroundedKpis,
    resolveIndustryBenchmark,
    resolveSuccessProbability,
    resolveOpportunities,
    resolveExecutiveSummaryData,
    resolveCreativeConcepts,
    resolveContentPlan,
    resolveWhyAi,
  } = modules;

  const strategy = resolveGroundedStrategyFields(undefined, campaign.brief);
  const budget = resolveBudgetData(undefined, campaign.brief);
  const kpis = resolveGroundedKpis(undefined, campaign.brief);
  const benchmark = resolveIndustryBenchmark(undefined, campaign.brief);
  const success = resolveSuccessProbability(undefined, campaign.brief);
  const opportunities = resolveOpportunities(undefined, campaign.brief);
  const executive = resolveExecutiveSummaryData(undefined, campaign.brief);
  const concepts = resolveCreativeConcepts(undefined, campaign.brief);
  const contentPlan = resolveContentPlan(undefined, campaign.brief);
  const whyAi = resolveWhyAi(undefined, campaign.brief);

  const badge = (source, conf) => `<span class="badge">${source} · ${conf}%</span>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${campaign.label} — Sprint 8.9</title>
<style>
  body { font-family: system-ui, sans-serif; background: #fafbff; padding: 24px; color: #111; }
  h1 { color: #1D9E75; } h2 { color: #7c3aed; margin-top: 24px; border-bottom: 2px solid #1D9E75; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: white; }
  .badge { display: inline-block; background: #1D9E7515; color: #1D9E75; border: 1px solid #1D9E7540; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
</style></head><body>
<h1>${campaign.label} — Grounded Campaign Studio</h1>

<h2>Executive Summary</h2>
<div class="card">${executive.summary}<br/>${badge(executive.grounding.source, executive.grounding.confidence)}</div>

<h2>Strategy (Grounded)</h2>
<div class="grid">${strategy.slice(0, 6).map((s) => `<div class="card"><strong>${s.label}</strong><br/>${s.value}<br/>${badge(s.grounding.source, s.grounding.confidence)}<br/><small>${s.grounding.reason}</small></div>`).join("")}</div>

<h2>Budget (with WHY)</h2>
${budget?.groundedAllocations?.map((a) => `<div class="card" style="margin-bottom:8px"><strong>${a.category} ${a.percent}%</strong><br/>${badge(a.source, a.confidence)}<br/><small>${a.reason}</small></div>`).join("") ?? ""}

<h2>KPI Forecast (Grounded)</h2>
<div class="grid">${kpis.slice(0, 6).map((k) => `<div class="card"><strong>${k.metric}</strong>: ${k.prediction}<br/>${badge("Historical", k.confidence)}<br/><small>${k.reason}</small></div>`).join("")}</div>

<h2>Industry Benchmark</h2>
<div class="grid">${benchmark.comparisons.map((c) => `<div class="card"><strong>${c.metric}</strong><br/>Expected: ${c.expected}<br/>Industry: ${c.industry}</div>`).join("")}</div>

<h2>Success Probability: ${success.score}%</h2>
<div class="grid"><div class="card"><strong>Strengths</strong><br/>${success.strengths.join("<br/>")}</div><div class="card"><strong>Improve</strong><br/>${success.improvements.join("<br/>")}</div></div>

<h2>Opportunities</h2>
${opportunities.map((o) => `<div class="card" style="margin-bottom:8px"><strong>${o.category}: ${o.title}</strong><br/>${o.description}</div>`).join("")}

<h2>Creative Concepts</h2>
<div class="grid">${concepts.map((c) => `<div class="card"><strong>${c.name}</strong><br/>Emotion: ${c.targetEmotion}<br/>Style: ${c.contentStyle}<br/>Hook: ${c.hook}</div>`).join("")}</div>

<h2>Content Plan</h2>
<table><tr><th>Platform</th><th>Type</th><th>Qty</th></tr>
${contentPlan.map((r) => `<tr><td>${r.platform}</td><td>${r.contentType}</td><td>${r.quantity}</td></tr>`).join("")}
</table>

<h2>Why AI</h2>
<div class="grid">${whyAi.map((w) => `<div class="card"><strong>${w.category}</strong><br/>${w.rationale}<br/><small>Evidence: ${w.evidence}</small></div>`).join("")}</div>
</body></html>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const resolver = await import("../features/campaign-studio/services/section-data-resolver.ts");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 3200 });

  for (const campaign of CAMPAIGNS) {
    const campaignDir = path.join(OUT_DIR, campaign.id);
    fs.mkdirSync(campaignDir, { recursive: true });
    const html = await buildPreviewHtml(campaign, resolver);
    const htmlPath = path.join(campaignDir, "preview.html");
    fs.writeFileSync(htmlPath, html);
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0" });
    await page.screenshot({ path: path.join(campaignDir, "campaign-studio-grounded.png"), fullPage: true });
    console.log(`Screenshot: ${path.join(campaignDir, "campaign-studio-grounded.png")}`);
  }

  await browser.close();
  console.log(`\nAll screenshots saved to ${OUT_DIR}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
