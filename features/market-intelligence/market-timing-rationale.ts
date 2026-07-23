/**
 * Strategy narrative snippets — explains WHY timing aligns with market behaviour.
 */

import type { MarketCountry, MarketOpportunityWindow, MarketSchedulingContext } from "./types";
import { scoreMarketOpportunityForWeek } from "./market-intelligence-engine";

export type MarketTimingRationaleInput = {
  context: MarketSchedulingContext;
  weekWeights: number[];
  durationWeeks: number;
  objective?: string;
};

/** Structured citation per market timing driver — rendered in Market Timing Intelligence. */
export type MarketTimingCitation = {
  driver: string;
  evidence: string;
  reason: string;
  impact: string;
  confidencePercent: number;
};

function topWindowsByStrength(
  windows: MarketOpportunityWindow[],
  limit = 4
): MarketOpportunityWindow[] {
  return [...windows]
    .sort((a, b) => b.peakStrength - a.peakStrength)
    .slice(0, limit);
}

function salaryNarrative(countries: MarketCountry[]): string | null {
  if (countries.some((c) => ["UAE", "Saudi Arabia", "Egypt", "Kuwait"].includes(c))) {
    return "Publishing front-loads around salary week and month-start windows when disposable income and conversion intent peak across MENA markets.";
  }
  if (countries.includes("UK") || countries.includes("USA")) {
    return "Schedule aligns with month-end and post-payday spending cycles when discretionary purchases accelerate.";
  }
  return null;
}

function detectRamadanInFlight(windows: MarketOpportunityWindow[]): boolean {
  return windows.some((w) => /ramadan/i.test(w.eventName));
}

function detectBackToSchool(windows: MarketOpportunityWindow[]): boolean {
  return windows.some((w) => /back to school/i.test(w.eventName));
}

function detectRetailPeak(windows: MarketOpportunityWindow[]): boolean {
  return windows.some((w) =>
    /white friday|black friday|singles day|prime day/i.test(w.eventName)
  );
}

function salaryCitation(countries: MarketCountry[]): MarketTimingCitation | null {
  if (countries.some((c) => ["UAE", "Saudi Arabia", "Egypt", "Kuwait"].includes(c))) {
    return {
      driver: "Salary cycle",
      evidence: "MENA month-start and salary-week purchase spikes (UAE, KSA, Egypt, Kuwait)",
      reason: "Disposable income peaks after salary disbursement — conversion intent rises in first 7–10 days of month.",
      impact: "Front-loads hero creator slots toward salary-aligned weeks when spacing rules allow.",
      confidencePercent: 82,
    };
  }
  if (countries.includes("UK") || countries.includes("USA")) {
    return {
      driver: "Payday cycle",
      evidence: "Month-end and post-payday discretionary spending patterns (UK / USA)",
      reason: "Discretionary purchases accelerate after payday — retail and lifestyle categories benefit.",
      impact: "Publishing clusters toward post-payday windows for conversion-led objectives.",
      confidencePercent: 75,
    };
  }
  return null;
}

function ramadanCitation(windows: MarketOpportunityWindow[]): MarketTimingCitation | null {
  if (!detectRamadanInFlight(windows)) return null;
  const event = windows.find((w) => /ramadan/i.test(w.eventName));
  return {
    driver: "Ramadan / Eid",
    evidence: event?.eventName ?? "Ramadan cultural window in campaign flight",
    reason: "Evening engagement and gifting categories peak — respectful pacing and community tone required.",
    impact: "Hero content weighted before and during celebration peaks; avoids insensitive daytime hard-sell.",
    confidencePercent: 88,
  };
}

function backToSchoolCitation(windows: MarketOpportunityWindow[]): MarketTimingCitation | null {
  if (!detectBackToSchool(windows)) return null;
  const event = windows.find((w) => /back to school/i.test(w.eventName));
  return {
    driver: "Back to School",
    evidence: event?.eventName ?? "School reopening season in market calendar",
    reason: "Family-oriented categories lift as households prepare for term start — apparel, devices, FMCG.",
    impact: "Publishing emphasises weeks overlapping school reopening for family and youth audiences.",
    confidencePercent: 79,
  };
}

function retailPeakCitation(windows: MarketOpportunityWindow[]): MarketTimingCitation | null {
  if (!detectRetailPeak(windows)) return null;
  const event = windows.find((w) =>
    /white friday|black friday|singles day|prime day/i.test(w.eventName)
  );
  return {
    driver: "Retail mega-event",
    evidence: event?.eventName ?? "White Friday / Black Friday / Singles Day window",
    reason: "Discount windows concentrate purchase intent — audiences expect offer-led content.",
    impact: "Activations cluster toward retail peaks without overriding fixed launch commitments.",
    confidencePercent: 85,
  };
}

function seasonalCitation(
  context: MarketSchedulingContext,
  weekWeights: number[],
  durationWeeks: number
): MarketTimingCitation | null {
  const seasonal = context.windows.find((w) =>
    /summer|winter|spring|autumn|holiday|season/i.test(w.eventName)
  );
  if (!seasonal) return null;
  const peakWeekIndex = weekWeights.reduce(
    (best, weight, index) => (weight > (weekWeights[best] ?? 0) ? index : best),
    0
  );
  return {
    driver: "Seasonal moment",
    evidence: `${seasonal.eventName} · ${context.category} vertical`,
    reason: "Seasonal relevance drives shareability — timely hooks outperform evergreen messaging.",
    impact: `Week ${peakWeekIndex + 1} emphasis (${weekWeights[peakWeekIndex]}% weight) aligns with seasonal peak.`,
    confidencePercent: 72,
  };
}

function nationalDayCitation(windows: MarketOpportunityWindow[]): MarketTimingCitation | null {
  const national = windows.find((w) =>
    /national day|independence|founding day|uae day|ksa day/i.test(w.eventName)
  );
  if (!national) return null;
  return {
    driver: "National day",
    evidence: national.eventName,
    reason: "Patriotic and celebratory content resonates — brand messaging should align with national pride tone.",
    impact: "Optional hero moments scheduled around national celebrations when brief allows cultural tie-in.",
    confidencePercent: 70,
  };
}

/** Structured citations per market driver — salary, Ramadan, retail peaks, seasons, national days. */
export function buildMarketTimingCitations(input: MarketTimingRationaleInput): MarketTimingCitation[] {
  const { context, weekWeights, durationWeeks } = input;
  if (!context.config.enabled) return [];

  const citations: MarketTimingCitation[] = [];

  if (context.config.toggles.salaryCycle) {
    const salary = salaryCitation(context.countries);
    if (salary) citations.push(salary);
  }

  if (context.config.toggles.ramadan) {
    const ramadan = ramadanCitation(context.windows);
    if (ramadan) citations.push(ramadan);
  }

  if (context.config.toggles.schoolCalendar) {
    const school = backToSchoolCitation(context.windows);
    if (school) citations.push(school);
  }

  if (context.config.toggles.retailSeasons) {
    const retail = retailPeakCitation(context.windows);
    if (retail) citations.push(retail);
  }

  if (context.config.toggles.weather !== false) {
    const seasonal = seasonalCitation(context, weekWeights, durationWeeks);
    if (seasonal) citations.push(seasonal);
  }

  if (context.config.toggles.nationalEvents !== false) {
    const national = nationalDayCitation(context.windows);
    if (national) citations.push(national);
  }

  const peakWeekIndex = weekWeights.reduce(
    (best, weight, index) => (weight > (weekWeights[best] ?? 0) ? index : best),
    0
  );
  const peakWeekScore = scoreMarketOpportunityForWeek(
    context.campaignStartDate,
    peakWeekIndex + 1,
    context
  );
  if (peakWeekScore.activeWindows.length && !citations.some((c) => c.driver === "Peak week alignment")) {
    citations.push({
      driver: "Peak week alignment",
      evidence: peakWeekScore.activeWindows.slice(0, 2).join(" · "),
      reason: `Week ${peakWeekIndex + 1} intersects highest-intent market windows in-flight.`,
      impact: "Reinforces strategic weight curve with calendar-backed timing rationale.",
      confidencePercent: Math.min(95, Math.round(peakWeekScore.score)),
    });
  }

  return citations.slice(0, 6);
}

/** Build market timing section for media plan strategy narrative. */
export function buildMarketTimingRationale(input: MarketTimingRationaleInput): string {
  const { context, weekWeights, durationWeeks, objective } = input;
  if (!context.config.enabled) {
    return "Market intelligence is disabled for this campaign — scheduling uses creator performance and journey weights only.";
  }

  const citations = buildMarketTimingCitations(input);
  const countries = context.countries.join(", ");
  const category = context.category;

  const parts: string[] = [
    `Market intelligence for ${countries} (${category} vertical) informs slot timing alongside creator quality and campaign objectives.`,
  ];

  for (const citation of citations.slice(0, 4)) {
    parts.push(`${citation.driver}: ${citation.reason}`);
  }

  if (objective?.match(/conversion|purchase|sales|roi/i)) {
    parts.push(
      "Conversion-led objective weighting pairs with salary and retail peaks — creator slots within high-intent windows are prioritised when spacing rules allow."
    );
  }

  if (context.config.toggles.weather === false || context.config.toggles.nationalEvents === false) {
    const disabled: string[] = [];
    if (!context.config.toggles.weather) disabled.push("weather/seasonal");
    if (!context.config.toggles.nationalEvents) disabled.push("national events");
    parts.push(`Disabled market factors: ${disabled.join(", ")}.`);
  }

  if (!citations.length) {
    const salaryNote = salaryNarrative(context.countries);
    if (salaryNote && context.config.toggles.salaryCycle) parts.push(salaryNote);
    const topEvents = topWindowsByStrength(context.windows, 3);
    if (topEvents.length) {
      parts.push(`Key market moments in-flight: ${topEvents.map((w) => w.eventName).join(", ")}.`);
    }
  }

  return parts.join(" ");
}

/** Short rationale lines for placement-level explainability. */
export function marketReasonsForPlacement(
  week: number,
  context: MarketSchedulingContext | undefined
): string[] {
  if (!context?.config.enabled) return [];
  const score = scoreMarketOpportunityForWeek(context.campaignStartDate, week, context);
  if (score.score < 58 || !score.reasons.length) return [];
  return score.reasons.slice(0, 2).map((reason) => `Market timing: ${reason}`);
}
