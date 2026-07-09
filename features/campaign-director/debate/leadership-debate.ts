import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "../types";
import type { CampaignOption, DirectorReview, DirectorRole } from "./debate-types";

const DIRECTOR_ROLES: DirectorRole[] = [
  "Strategy Director",
  "Media Director",
  "Creator Director",
  "Finance Director",
  "Risk Director",
  "Performance Director",
  "Presentation Director",
];

function tierSummary(option: CampaignOption): string {
  return option.creatorTierStrategy.map((t) => `${t.tier} ${t.allocationPercent}%`).join(" · ");
}

function reviewForRole(
  role: DirectorRole,
  option: CampaignOption,
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument
): DirectorReview {
  const brand = facts.brandName ?? strategy.understanding.brand;
  const tiers = tierSummary(option);
  const archetype = option.archetype;

  switch (role) {
    case "Strategy Director":
      return strategyDirectorReview(option, brand, tiers, archetype);
    case "Media Director":
      return mediaDirectorReview(option, brand, tiers, archetype);
    case "Creator Director":
      return creatorDirectorReview(option, brand, tiers, archetype);
    case "Finance Director":
      return financeDirectorReview(option, brand, tiers, archetype, facts);
    case "Risk Director":
      return riskDirectorReview(option, brand, tiers, archetype);
    case "Performance Director":
      return performanceDirectorReview(option, brand, tiers, archetype, facts);
    case "Presentation Director":
      return presentationDirectorReview(option, brand, tiers, archetype);
    default:
      return {
        directorRole: role,
        optionId: option.id,
        strength: "N/A",
        weakness: "N/A",
        commercialRisk: "N/A",
        wouldApprove: false,
        score: 50,
        explanation: "Unknown director role",
      };
  }
}

function strategyDirectorReview(
  option: CampaignOption,
  brand: string,
  tiers: string,
  archetype: CampaignOption["archetype"]
): DirectorReview {
  if (archetype === "max_reach") {
    return {
      directorRole: "Strategy Director",
      optionId: option.id,
      strength: `Delivers immediate top-of-funnel coverage for ${brand} — ${tiers} creates awareness burst aligned to reach KPIs.`,
      weakness: "Sacrifices peer-trust UGC depth — engagement transfer weaker for consideration-stage objectives.",
      commercialRisk: "High Macro/Mega fee concentration reduces roster flexibility if availability slips.",
      wouldApprove: false,
      score: 62,
      explanation: "Reach-first plan viable for pure awareness but misaligned when brief requires UGC and trust transfer.",
    };
  }
  if (archetype === "balanced") {
    return {
      directorRole: "Strategy Director",
      optionId: option.id,
      strength: `Default Director tier waterfall (${tiers}) balances reach and authenticity for ${brand}.`,
      weakness: "Neither maximizes reach nor engagement — middle path may under-deliver on both axes.",
      commercialRisk: "Moderate — no extreme trade-offs but lacks decisive strategic differentiation.",
      wouldApprove: true,
      score: 78,
      explanation: "Solid baseline aligned to CampaignFacts SSOT — acceptable when client wants proven tier mix.",
    };
  }
  return {
    directorRole: "Strategy Director",
    optionId: option.id,
    strength: `UGC-first Micro/Nano mix (${tiers}) maximizes peer-trust for ${brand} — strongest alignment to authenticity objectives.`,
    weakness: "Lower gross reach — requires client acceptance of engagement-over-impressions framing.",
    commercialRisk: "Ramp activation delays peak reach until mid-campaign — client may question slower Week 1 velocity.",
    wouldApprove: true,
    score: 88,
    explanation: "Engagement-first plan wins when brief prioritizes UGC, trial conversion, or community participation over burst reach.",
  };
}

function mediaDirectorReview(
  option: CampaignOption,
  brand: string,
  tiers: string,
  archetype: CampaignOption["archetype"]
): DirectorReview {
  if (archetype === "max_reach") {
    return {
      directorRole: "Media Director",
      optionId: option.id,
      strength: `Burst activation (${option.timeline.activationPlan.weekWeights[0]}% Week 1) maximizes platform algorithm boost from Macro/Mega posting cadence over ${option.timeline.durationWeeks} weeks.`,
      weakness: "Front-loaded posting creates content cliff — no sustained mid-campaign velocity.",
      commercialRisk: "Platform saturation risk if all Macro posts land same week.",
      wouldApprove: false,
      score: 58,
      explanation: `${option.timeline.activationOrder} — aggressive but fragile; one booking slip collapses reach window.`,
    };
  }
  if (archetype === "balanced") {
    return {
      directorRole: "Media Director",
      optionId: option.id,
      strength: `${option.timeline.durationWeeks}-week tier-sequenced plan (${tiers}) maintains weekly content velocity.`,
      weakness: "Standard cadence — no platform-specific optimization beyond default mix.",
      commercialRisk: "Low — proven activation pattern.",
      wouldApprove: true,
      score: 76,
      explanation: "Media plan follows Director timeline rules — client-facing weeks match facts duration.",
    };
  }
  return {
    directorRole: "Media Director",
    optionId: option.id,
    strength: `Ramp activation (${option.timeline.activationPlan.approach}, ${option.timeline.durationWeeks} weeks) allows Nano/Micro onboarding before UGC peak — ${option.timeline.activationOrder}.`,
    weakness: "Longer client-facing duration increases coordination overhead.",
    commercialRisk: "Creator drop-off risk across extended recruitment phase.",
    wouldApprove: true,
    score: 84,
    explanation: "Ramp timeline justified for UGC volume — Nano/Micro sequencing protects engagement KPIs.",
  };
}

function creatorDirectorReview(
  option: CampaignOption,
  _brand: string,
  tiers: string,
  archetype: CampaignOption["archetype"]
): DirectorReview {
  if (archetype === "max_reach") {
    return {
      directorRole: "Creator Director",
      optionId: option.id,
      strength: `Macro/Mega roster (${tiers}) simplifies vendor booking — fewer creators, higher per-creator fees.`,
      weakness: "Nano/Micro under-represented — UGC asset library will be thin (5–15% Nano allocation).",
      commercialRisk: "Creator exclusivity conflicts more likely with Macro/Mega tier in compressed window.",
      wouldApprove: false,
      score: 55,
      explanation: "Creator mix too top-heavy for campaigns requiring authentic peer voices and UGC volume.",
    };
  }
  if (archetype === "balanced") {
    return {
      directorRole: "Creator Director",
      optionId: option.id,
      strength: `Balanced roster (${tiers}) provides tier diversity for vendor funnel filtering.`,
      weakness: "Mid-tier creators may lack distinct role clarity vs specialized reach or engagement plans.",
      commercialRisk: "Moderate roster complexity — 3–4 tiers to coordinate.",
      wouldApprove: true,
      score: 74,
      explanation: "Standard tier mix manageable in vendor discovery pipeline.",
    };
  }
  return {
    directorRole: "Creator Director",
    optionId: option.id,
    strength: `Heavy Micro/Nano (${tiers}) maximizes UGC volume and community authenticity — 80%+ roster in engagement tiers.`,
    weakness: "Nano quality variance requires stronger fraud/safety filters in vendor funnel.",
    commercialRisk: "Higher creator count increases onboarding and content approval workload.",
    wouldApprove: true,
    score: 90,
    explanation: "Creator mix best supports UGC-first objectives — Nano/Micro survived debate as primary activation tiers.",
  };
}

function financeDirectorReview(
  option: CampaignOption,
  brand: string,
  tiers: string,
  archetype: CampaignOption["archetype"],
  facts: CampaignFacts
): DirectorReview {
  const budgetRef = facts.budget
    ? `${facts.budget.currency} ${facts.budget.amount.toLocaleString()}`
    : "TBD budget";

  if (archetype === "max_reach") {
    return {
      directorRole: "Finance Director",
      optionId: option.id,
      strength: `${option.budget.creatorFeePercent}% creator fees — fewer high-fee Macro/Mega bookings simplify PO tracking.`,
      weakness: `Premium tier fees consume ${budgetRef} faster — 8% contingency insufficient for Macro negotiation variance.`,
      commercialRisk: "Budget overrun likely if Macro rates exceed benchmark — no Nano buffer to reallocate.",
      wouldApprove: false,
      score: 52,
      explanation: "Cheaper Nano/Micro allocation rejected — Macro-heavy plan burns budget without UGC efficiency gains.",
    };
  }
  if (archetype === "balanced") {
    return {
      directorRole: "Finance Director",
      optionId: option.id,
      strength: `${option.budget.creatorFeePercent}% creator fees + ${option.budget.contingencyPercent}% contingency — standard allocation for ${brand}.`,
      weakness: "No cost optimization vs engagement-first Nano/Micro volume plan.",
      commercialRisk: "Low — proven fee model.",
      wouldApprove: true,
      score: 77,
      explanation: "Budget allocation totals 100% influencer model — acceptable default.",
    };
  }
  return {
    directorRole: "Finance Director",
    optionId: option.id,
    strength: `${option.budget.creatorFeePercent}% creator fees — Nano/Micro volume (${tiers}) delivers lowest cost-per-UGC-asset.`,
      weakness: "15% contingency reflects UGC revision cycles — net roster size slightly smaller.",
      commercialRisk: "Extended timeline may trigger scope creep on creator deliverables.",
      wouldApprove: true,
      score: 86,
      explanation: "Cost-efficient engagement plan — cheaper per-tier allocation rejected in favor of UGC volume efficiency.",
  };
}

function riskDirectorReview(
  option: CampaignOption,
  brand: string,
  _tiers: string,
  archetype: CampaignOption["archetype"]
): DirectorReview {
  const topRisk = option.risks[0] ?? "Standard vendor availability risk";
  if (archetype === "max_reach") {
    return {
      directorRole: "Risk Director",
      optionId: option.id,
      strength: "Fewer creators reduces coordination risk surface.",
      weakness: topRisk,
      commercialRisk: "Single Macro/Mega cancellation eliminates 30–45% of planned reach.",
      wouldApprove: false,
      score: 48,
      explanation: `Option A rejected — concentration risk too high for ${brand}; ${topRisk}.`,
    };
  }
  if (archetype === "balanced") {
    return {
      directorRole: "Risk Director",
      optionId: option.id,
      strength: "Tier diversification spreads availability risk across roster.",
      weakness: topRisk,
      commercialRisk: "Moderate — standard campaign risk profile.",
      wouldApprove: true,
      score: 75,
      explanation: "Acceptable risk profile — no extreme concentration or quality variance.",
    };
  }
  return {
    directorRole: "Risk Director",
    optionId: option.id,
    strength: "Nano/Micro diversification — no single creator carries >5% of campaign narrative.",
    weakness: topRisk,
    commercialRisk: "UGC quality variance manageable with pre-approved script library and brand safety filters.",
    wouldApprove: true,
    score: 82,
    explanation: "Engagement plan risk acceptable — UGC quality mitigated by vendor funnel brand_safety stage.",
  };
}

function performanceDirectorReview(
  option: CampaignOption,
  brand: string,
  tiers: string,
  archetype: CampaignOption["archetype"],
  facts: CampaignFacts
): DirectorReview {
  const objective = facts.objective ?? "campaign objectives";
  const kpiSummary = option.kpis.map((k) => `${k.metric}: ${k.target}`).join("; ");

  if (archetype === "max_reach") {
    return {
      directorRole: "Performance Director",
      optionId: option.id,
      strength: `Impressions-led KPIs (${kpiSummary}) achievable with Macro/Mega mix (${tiers}).`,
      weakness: "Engagement KPIs likely under-deliver — ER targets not prioritized.",
      commercialRisk: `${objective} may not correlate with impressions if brief requires UGC/trial conversion.`,
      wouldApprove: false,
      score: 54,
      explanation: "Aggressive reach KPIs rejected when brief objective requires engagement depth over gross impressions.",
    };
  }
  if (archetype === "balanced") {
    return {
      directorRole: "Performance Director",
      optionId: option.id,
      strength: `KPI mix from CampaignFacts (${kpiSummary}) — balanced achievability.`,
      weakness: "No KPI axis maximized — may appear conservative to client.",
      commercialRisk: "Low forecast variance.",
      wouldApprove: true,
      score: 76,
      explanation: "Standard KPI framework — acceptable baseline.",
    };
  }
  return {
    directorRole: "Performance Director",
    optionId: option.id,
    strength: `ER-led KPIs (${kpiSummary}) aligned to Micro/Nano UGC plan — ${brand} engagement targets achievable.`,
    weakness: "Reach/impression targets lower vs Option A — client must accept trade-off.",
    commercialRisk: "UGC volume KPI depends on Nano onboarding success rate.",
    wouldApprove: true,
    score: 89,
    explanation: "Selected KPIs vs more aggressive reach targets — engagement metrics better match tier mix and brief objective.",
  };
}

function presentationDirectorReview(
  option: CampaignOption,
  brand: string,
  tiers: string,
  archetype: CampaignOption["archetype"]
): DirectorReview {
  if (archetype === "max_reach") {
    return {
      directorRole: "Presentation Director",
      optionId: option.id,
      strength: "Clear reach narrative — easy client story: 'maximum eyeballs in minimum time'.",
      weakness: "Weak UGC proof story — client may question authenticity claims with 5% Nano mix.",
      commercialRisk: "Presentation gap if client expects mom-to-mom / peer validation case studies.",
      wouldApprove: false,
      score: 56,
      explanation: "Option A hard to defend in client presentation when category requires trust transfer.",
    };
  }
  if (archetype === "balanced") {
    return {
      directorRole: "Presentation Director",
      optionId: option.id,
      strength: `Standard agency deck structure — ${tiers} maps cleanly to budget/timeline slides.`,
      weakness: "Lacks bold strategic hook — 'balanced' may read as uninspired.",
      commercialRisk: "Low — familiar format.",
      wouldApprove: true,
      score: 73,
      explanation: "Presentable but not differentiated — safe client recommendation.",
    };
  }
  return {
    directorRole: "Presentation Director",
    optionId: option.id,
    strength: `Strong UGC narrative for ${brand} — 'authentic voices at scale' deck with Nano/Micro case studies (${tiers}).`,
    weakness: "Must educate client on reach vs engagement trade-off upfront.",
    commercialRisk: "Client may initially prefer Option A reach numbers — requires Director framing.",
    wouldApprove: true,
    score: 87,
    explanation: "Winning presentation story — engagement-first plan with documented debate rationale.",
  };
}

/** Run agency leadership debate — 7 directors review ALL 3 options (no editing). */
export function runLeadershipDebate(
  options: CampaignOption[],
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument
): DirectorReview[] {
  const reviews: DirectorReview[] = [];

  for (const option of options) {
    for (const role of DIRECTOR_ROLES) {
      reviews.push(reviewForRole(role, option, facts, strategy));
    }
  }

  return reviews;
}

export { DIRECTOR_ROLES };
