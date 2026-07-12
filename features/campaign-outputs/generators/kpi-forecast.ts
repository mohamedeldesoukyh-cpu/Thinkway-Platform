/**
 * KPI Forecast generator — deterministic outcome projection.
 *
 * Derives only from its declared inputs (budget + platforms + KPI targets), so
 * the dependency graph stays honest: a KPI-target or budget change refreshes it,
 * a creator-slate change does not. Projects impressions / reach / engagements
 * from the budget using per-platform benchmarks, then measures each KPI target
 * against the projection.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import type { CampaignOutputContent } from "../output-types";
import { benchmarkFor, formatMoney, parseKpiTargets } from "./generator-utils";

export const KPI_FORECAST_GENERATOR_VERSION = "1.0.0";

function round(n: number): number {
  return Math.round(n);
}

export function generateKpiForecast(campaignObject: CampaignObject): CampaignOutputContent {
  const facts = getCampaignFacts(campaignObject);
  const budget = facts?.budget;
  const platforms = facts?.platforms?.length ? facts.platforms : ["Instagram"];
  const targets = parseKpiTargets(facts?.kpis ?? []);

  const currency = budget?.currency ?? "";
  const totalBudget = budget?.amount ?? 0;
  const share = totalBudget / platforms.length;

  const perPlatform = platforms.map((platform) => {
    const bench = benchmarkFor(platform);
    const impressions = bench.cpm > 0 ? (share / bench.cpm) * 1000 : 0;
    const reach = impressions * bench.reachFactor;
    const engagements = impressions * bench.engagementRate;
    return { platform, impressions: round(impressions), reach: round(reach), engagements: round(engagements) };
  });

  const totalImpressions = perPlatform.reduce((n, p) => n + p.impressions, 0);
  const totalReach = perPlatform.reduce((n, p) => n + p.reach, 0);
  const totalEngagements = perPlatform.reduce((n, p) => n + p.engagements, 0);
  const blendedEngagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

  const projectionFor = (metric: string): number | undefined => {
    switch (metric) {
      case "reach":
        return totalReach;
      case "impressions":
      case "views":
        return totalImpressions;
      case "engagement":
        return totalEngagements;
      case "engagement_rate":
        return Number(blendedEngagementRate.toFixed(2));
      default:
        return undefined;
    }
  };

  const targetRows = targets.map((target) => {
    const projected = projectionFor(target.metric);
    const status =
      projected === undefined
        ? "Not modeled"
        : projected >= target.value
          ? "On track"
          : `Gap ${Math.round((1 - projected / (target.value || 1)) * 100)}%`;
    return {
      label: target.label,
      target: target.value,
      projected,
      status,
      isPercent: target.isPercent,
    };
  });

  const sections: CampaignOutputContent["sections"] = [
    {
      heading: "Forecast Basis",
      items: [
        budget ? `Budget: ${formatMoney(totalBudget, currency)}` : "Budget: to be confirmed",
        `Platforms: ${platforms.join(", ")}`,
        "Method: budget-driven projection using per-platform CPM, reach, and engagement benchmarks",
      ],
    },
    {
      heading: "Projected Outcomes",
      table: {
        columns: ["Platform", "Impressions", "Reach", "Engagements"],
        rows: [
          ...perPlatform.map((p) => [
            p.platform,
            p.impressions.toLocaleString(),
            p.reach.toLocaleString(),
            p.engagements.toLocaleString(),
          ]),
          [
            "Total",
            totalImpressions.toLocaleString(),
            totalReach.toLocaleString(),
            totalEngagements.toLocaleString(),
          ],
        ],
      },
    },
  ];

  if (targetRows.length) {
    sections.push({
      heading: "Targets vs Projection",
      table: {
        columns: ["KPI target", "Target", "Projected", "Status"],
        rows: targetRows.map((row) => [
          row.label,
          row.isPercent ? `${row.target}%` : row.target.toLocaleString(),
          row.projected === undefined
            ? "—"
            : row.isPercent
              ? `${row.projected}%`
              : row.projected.toLocaleString(),
          row.status,
        ]),
      },
    });
  }

  const gaps = targetRows.filter((r) => typeof r.status === "string" && r.status.startsWith("Gap"));
  sections.push({
    heading: "Recommendations",
    items: [
      gaps.length
        ? `Close the gap on ${gaps.map((g) => g.label).join(", ")} by concentrating budget on the highest-efficiency platform (${perPlatform.slice().sort((a, b) => b.reach - a.reach)[0]?.platform ?? platforms[0]}).`
        : "Projection meets the stated KPI targets — hold the current budget split and protect an optimization reserve.",
      "Validate benchmarks against historical campaign performance before client sign-off.",
    ],
  });

  return {
    title: "KPI Forecast",
    summary: budget
      ? `Projected ${totalReach.toLocaleString()} reach and ${totalEngagements.toLocaleString()} engagements from ${formatMoney(totalBudget, currency)} across ${platforms.length} platform${platforms.length === 1 ? "" : "s"}.`
      : "KPI forecast pending a confirmed budget.",
    sections,
    data: {
      currency,
      totalImpressions,
      totalReach,
      totalEngagements,
      blendedEngagementRate: Number(blendedEngagementRate.toFixed(2)),
      perPlatform,
      targets: targetRows,
    },
  };
}
