import type {
  BudgetSectionData,
  KpiForecastSectionData,
  PresentationStatusSectionData,
  RiskAnalysisSectionData,
  TimelineSectionData,
} from "../types/section-schemas";
import {
  isBudgetSectionData,
  isKpiForecastSectionData,
  isPresentationStatusSectionData,
  isRiskAnalysisSectionData,
  isTimelineSectionData,
} from "../types/section-schemas";

import { formatMoneyKpi } from "@/lib/finance/currency-format";

function formatCurrency(amount: number, currency: string): string {
  return formatMoneyKpi(amount, currency);
}

export function formatBudgetForDisplay(data: BudgetSectionData): string {
  const lines: string[] = [`**Currency:** ${data.currency}`];

  if (data.total != null) {
    lines.push(`**Total budget:** ${formatCurrency(data.total, data.currency)}`);
  }

  lines.push("");
  lines.push("**Allocation:**");
  for (const line of data.allocations) {
    const parts: string[] = [line.category];
    if (line.amount != null) parts.push(formatCurrency(line.amount, data.currency));
    if (line.percent != null) parts.push(`(${line.percent}%)`);
    lines.push(`- ${parts.join(" — ")}`);
  }

  if (data.contingencyPercent != null) {
    lines.push("");
    lines.push(`**Contingency:** ${data.contingencyPercent}%`);
  }

  return lines.join("\n");
}

export function formatTimelineForDisplay(data: TimelineSectionData): string {
  const lines: string[] = [];

  if (data.durationWeeks) {
    lines.push(`**Duration:** ${data.durationWeeks} weeks`);
  }
  if (data.goLiveWeek) {
    lines.push(`**Go-live:** Week ${data.goLiveWeek}`);
  }

  lines.push("");
  for (const milestone of data.milestones) {
    lines.push(`**Week ${milestone.week}** — ${milestone.phase}`);
    for (const activity of milestone.activities) {
      lines.push(`  · ${activity}`);
    }
  }

  return lines.join("\n");
}

export function formatKpiForecastForDisplay(data: KpiForecastSectionData): string {
  const lines: string[] = ["**KPI Forecast**", ""];

  for (const kpi of data.kpis) {
    const platform = kpi.platform ? ` (${kpi.platform})` : "";
    const benchmark = kpi.benchmark ? ` · benchmark: ${kpi.benchmark}` : "";
    lines.push(`- **${kpi.metric}**${platform}: ${kpi.target}${benchmark}`);
  }

  if (data.forecastNotes) {
    lines.push("");
    lines.push(`_${data.forecastNotes}_`);
  }

  return lines.join("\n");
}

export function formatRiskAnalysisForDisplay(data: RiskAnalysisSectionData): string {
  const lines: string[] = [];

  if (data.overallRiskLevel) {
    lines.push(`**Overall risk:** ${data.overallRiskLevel.toUpperCase()}`);
    lines.push("");
  }

  for (const item of data.risks) {
    const mitigation = item.mitigation ? `\n  Mitigation: ${item.mitigation}` : "";
    const category = item.category ? ` [${item.category}]` : "";
    lines.push(`- [${item.severity.toUpperCase()}]${category} ${item.risk}${mitigation}`);
  }

  return lines.join("\n");
}

export function formatPresentationStatusForDisplay(data: PresentationStatusSectionData): string {
  const lines: string[] = [
    `**Status:** ${data.status.replace(/_/g, " ")}`,
    data.campaignName ? `**Campaign:** ${data.campaignName}` : "",
    data.brandName ? `**Brand:** ${data.brandName}` : "",
    data.lineCount != null ? `**Campaign lines:** ${data.lineCount}` : "",
    "",
    data.message,
  ];

  if (data.nextStep) {
    lines.push("");
    lines.push(`**Next step:** ${data.nextStep}`);
  }

  return lines.filter((line, index) => line !== "" || index === 0).join("\n");
}

export function formatSectionContentForDisplay(
  content: string | Record<string, unknown>
): string {
  if (typeof content === "string") {
    return content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .trim();
  }

  if (isBudgetSectionData(content)) return formatBudgetForDisplay(content);
  if (isTimelineSectionData(content)) return formatTimelineForDisplay(content);
  if (isKpiForecastSectionData(content)) return formatKpiForecastForDisplay(content);
  if (isRiskAnalysisSectionData(content)) return formatRiskAnalysisForDisplay(content);
  if (isPresentationStatusSectionData(content)) {
    return formatPresentationStatusForDisplay(content);
  }

  return "[structured content]";
}

export function tryParseJsonBlock(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  if (!candidate.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
