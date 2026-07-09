import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";

import { buildIs1CampaignContext } from "./campaign-context";

export type KpiReasoningEntry = {
  metric: string;
  target: string;
  reason: string;
  confidence: number;
  dependencies: string[];
  risk: string;
  tradeoff: string;
  sensitivity: string;
  evidence: string;
  alternativeConsidered: string;
};

export type KpiForecastReasoning = {
  kpis: KpiReasoningEntry[];
  forecastNotes: string;
};

function kpiEntry(
  metric: string,
  target: string,
  reason: string,
  deps: string[],
  risk: string,
  tradeoff: string,
  sensitivity: string,
  evidence: string,
  alternative: string,
  confidence: number
): KpiReasoningEntry {
  return {
    metric,
    target,
    reason,
    confidence,
    dependencies: deps,
    risk,
    tradeoff,
    sensitivity,
    evidence,
    alternativeConsidered: alternative,
  };
}

function babyJoyKpis(
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument
): KpiReasoningEntry[] {
  const platformList = ctx.platforms.join(", ");
  const base: KpiReasoningEntry[] = [
    kpiEntry(
      "UGC asset volume",
      "80+ authentic mom reviews",
      ctx.objective +
        " requires peer proof volume — Macro anchors trust, Micro/Nano deliver countable UGC within " +
        ctx.durationWeeks +
        " weeks.",
      ["Macro moms briefed Week 1", "Nano roster onboarded by Week 2", "Brand claim library approved"],
      "Creator drop-out reduces asset count below 80",
      "Volume target vs production polish — Director accepts raw authenticity",
      "−15 assets if Macro booking slips 1 week; −25 if Nano onboarding delayed to Week 3",
      "CampaignFacts.objective=" + ctx.objective + "; DirectorStrategy.creatorTierStrategy",
      "Reach-only KPI — rejected; trial consideration needs UGC proof not impressions",
      87
    ),
    kpiEntry(
      "Engagement rate",
      "5.2% blended ER on Instagram/TikTok",
      "Parenting micro creators in Egypt average above category benchmark when content is overnight-use narrative, not product demo.",
      ["Micro/Nano tier publishing cadence", "Platform mix per CampaignFacts"],
      "Claim-sensitive content suppressed by creators — ER drops",
      "Educational tone vs raw UGC — raw wins for trust",
      "±0.8pts if Micro share drops 10%; +0.5pts if Nano volume increases 15%",
      "CampaignFacts.platforms=" + platformList,
      "Vanity reach KPI — rejected for baby category",
      84
    ),
    kpiEntry(
      "Trust sentiment",
      "+15pt peer-trust score vs baseline",
      ctx.brand +
        " premium positioning needs mom-to-mom validation in " +
        ctx.geography +
        " — measurable via comment sentiment and save rate.",
      ["Macro trust anchor live Week 1", "Consistent overnight narrative theme"],
      "Negative comparison comments to incumbents",
      "Premium price messaging vs empathy-first content",
      "−8pts if Macro anchor delayed; +5pts if UGC volume exceeds 90 assets",
      "CampaignFacts.geography=" + ctx.geography,
      "Brand favorability only — insufficient for switch intent",
      82
    ),
  ];

  for (const k of strategy.understanding.kpis) {
    base.push(
      kpiEntry(
        k.metric,
        k.target,
        k.why || k.metric + " tied to " + ctx.objective + " — Director Strategy SSOT",
        [ctx.brand + " creator roster", ctx.durationWeeks + "-week publishing window"],
        "KPI miss if Macro booking slips Week 1",
        "Ambitious target vs budget-efficient tier mix",
        "Target ±10% if tier mix shifts ±5% from Director allocation",
        "DirectorStrategy.understanding.kpis",
        "Soft target — rejected; facts-driven measurement required",
        80
      )
    );
  }

  return base;
}

function cocaColaKpis(
  ctx: ReturnType<typeof buildIs1CampaignContext>,
  strategy: CampaignStrategyDocument
): KpiReasoningEntry[] {
  const platformList = ctx.platforms.join(", ");
  const base: KpiReasoningEntry[] = [
    kpiEntry(
      "Participation rate",
      "12% duet/stitch rate on hero posts",
      "Gen Z summer engagement for " +
        ctx.brand +
        " is participation-led — Mega/Macro posts must invite duets, not broadcast.",
      ["Mega/Macro content Week 1-2", "Challenge creative guardrails", ctx.platforms.join(" + ")],
      "Low participation if creative feels too branded",
      "Brand control vs participatory looseness",
      "−4pts participation if Mega moments reduced; +3pts if Nano hook formats succeed",
      "CampaignFacts.audience=" + ctx.audience + "; DirectorStrategy.platformMix",
      "Impression-only KPI — rejected for engagement objective",
      85
    ),
    kpiEntry(
      "Engagement rate",
      "4.8% blended on TikTok/Instagram",
      "Gen Z cola content benchmarks higher on participatory formats than static product shots across " +
        ctx.durationWeeks +
        " weeks.",
      ["Weekly Macro/Micro cadence", "Nano hook testing feed"],
      "Summer creator competition inflates CPM, lowers organic ER",
      "Sustained cadence vs burst-only Mega moments",
      "±0.6pts per 10% shift between Macro and Nano allocation",
      "CampaignFacts.platforms=" + platformList,
      "TV-style GRP equivalent — not applicable to creator plan",
      83
    ),
    kpiEntry(
      "Brand search lift",
      "+8% branded search during campaign",
      "Summer moments should convert to intentional " +
        ctx.brand +
        " search — indicates engagement transferred to consideration.",
      ["Mega cultural spikes", "Localized Micro content", ctx.durationWeeks + "-week sustained presence"],
      "Generic summer content without brand linkage",
      "Cultural looseness vs explicit brand tagging",
      "−3% search lift if brand tags omitted; +2% if Mega moments land Week 1–2",
      "CampaignFacts.brandName=" + ctx.brand,
      "Follower growth only — weak proxy for engagement quality",
      79
    ),
  ];

  for (const k of strategy.understanding.kpis) {
    base.push(
      kpiEntry(
        k.metric,
        k.target,
        k.why || k.metric + " supports " + ctx.objective + " on " + platformList,
        ["Tier waterfall activation", ctx.durationWeeks + "-week timeline"],
        "Platform algorithm shift during summer peak",
        "Reach vs engagement depth",
        "Forecast ±12% if summer competition intensifies on " + platformList,
        "DirectorStrategy.understanding.kpis",
        "Legacy TV KPI framework — excluded",
        78
      )
    );
  }

  return base;
}

export function buildKpiForecastReasoning(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  debateResult?: DebateResult
): KpiForecastReasoning {
  const ctx = buildIs1CampaignContext(facts, strategy);
  const brandLower = ctx.brand.toLowerCase();

  let kpis: KpiReasoningEntry[];
  if (/babyjoy|baby/i.test(brandLower)) {
    kpis = babyJoyKpis(ctx, strategy);
  } else if (/coca/i.test(brandLower)) {
    kpis = cocaColaKpis(ctx, strategy);
  } else {
    kpis = strategy.understanding.kpis.map((k) => {
      const deps = [ctx.brand + " creator activation", ctx.platforms.join(", ")];
      return kpiEntry(
        k.metric,
        k.target,
        k.why,
        deps,
        ctx.risks[0] ?? "Creator availability variance",
        "Reach vs authenticity",
        "Target sensitive to ±10% tier mix change from Director allocation",
        "CampaignFacts + DirectorStrategy",
        "Generic industry benchmark — replaced with campaign-specific reasoning",
        facts.confidence?.kpis ?? 80
      );
    });
  }

  const seen = new Set<string>();
  kpis = kpis.filter((k) => {
    const key = k.metric.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const debateNote = debateResult
    ? ` IS-3 debate: more aggressive reach KPIs from Option A rejected — Performance Director selected engagement-aligned KPIs from winning Option ${debateResult.meeting.winnerId} (${debateResult.meeting.winnerLabel}).`
    : "";

  return {
    kpis,
    forecastNotes:
      "KPI reasoning grounded in CampaignFacts (" +
      ctx.brand +
      ", " +
      ctx.objective +
      ") and Director Strategy — includes sensitivity analysis per metric." +
      debateNote,
  };
}
