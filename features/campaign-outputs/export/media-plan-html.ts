/**
 * Media Plan HTML — client-safe markup builder for in-app preview and HTML download.
 */
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";

import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import type {
  MediaPlanCampaignContext,
  MediaPlanData,
  MediaPlanDay,
  MediaPlanDayType,
} from "../generators/media-plan";
import {
  MEDIA_PLAN_COST_VAT_DISCLAIMER,
  formatMediaPlanPreparedForLabel,
  isMediaPlanOpenPublishingSlot,
} from "../generators/media-plan";
import { formatMoney } from "../generators/generator-utils";
import {
  formatDayColumnDate,
  formatWeekRangeLabel,
  parseCampaignStartDate,
} from "../media-plan-week-range";
import { buildMediaPlanStrategyBlocks, type MediaPlanStrategyBlock } from "../media-plan-strategy-blocks";
import { MEDIA_PLAN_BRAND, MEDIA_PLAN_AD_TYPE_COLORS, MEDIA_PLAN_DAY_TYPE_COLORS } from "../components/media-plan-brand";
import { mergeMediaPlanContext } from "../components/media-plan-context-merge";
import { isMediaPlanContent } from "./media-plan-content";
import { MEDIA_PLAN_PAGE } from "./media-plan-page";
import {
  renderThinkwayReportLogoHtml,
  THINKWAY_REPORT_LOGO_STYLES,
  type ThinkwayReportLogoSrcs,
} from "@/lib/reports/document/thinkway-report-logo";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MEDIA_PLAN_DEADLINES_HEADING = "Production & Asset Delivery Deadlines";

const SKIP_SECTION_HEADINGS = new Set([
  "Campaign Cost",
  "Activation Waves",
  "Platform Allocation",
  "Creator Dependencies",
  "Milestones & Windows",
  MEDIA_PLAN_DEADLINES_HEADING,
]);

const GENERIC_OPERATIONAL_TYPES = new Set([
  "Stories",
  "Paid amplification",
  "Reporting",
  "Stories slot",
  "Performance review",
]);

const PLATFORM_BAR_COLORS = [
  MEDIA_PLAN_BRAND.electricBlue,
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
];

const PAGE_BREAK = `<div class="mp-page-break" aria-hidden="true"></div>`;

export type BuildMediaPlanHtmlOptions = {
  contextOverride?: MediaPlanCampaignContext;
  logoSrcs?: ThinkwayReportLogoSrcs;
};

function mediaPlanLogo(
  options: BuildMediaPlanHtmlOptions | undefined,
  variant: "header" | "cover" | "closing",
  theme: "dark" | "light"
): string {
  return renderThinkwayReportLogoHtml({
    variant,
    theme,
    ...options?.logoSrcs,
  });
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typesForDay(day: MediaPlanDay): string[] {
  const primary = day.serviceTypes?.length
    ? day.serviceTypes
    : day.serviceType?.trim()
      ? [day.serviceType]
      : [];
  const additional =
    day.additionalDeliverables
      ?.filter((entry) => !entry.isMirror)
      .map((entry) => entry.serviceType)
      .filter((type): type is string => Boolean(type?.trim())) ?? [];
  const mirrors =
    day.additionalDeliverables
      ?.filter((entry) => entry.isMirror)
      .map((entry) => entry.serviceType)
      .filter((type): type is string => Boolean(type?.trim())) ?? [];
  return [...new Set([...primary, ...mirrors, ...additional])];
}

function collectLegendTypes(data: MediaPlanData): string[] {
  const fromDays = data.weeks.flatMap((week) => week.days.flatMap((day) => typesForDay(day)));
  const fromData = data.serviceTypes?.length ? data.serviceTypes : fromDays;
  return [...new Set(fromData)].filter(
    (type): type is string => Boolean(type?.trim() && !GENERIC_OPERATIONAL_TYPES.has(type))
  );
}

function buildAdTypeColorMap(types: string[]): Map<string, string> {
  return new Map(
    types.map((type, index) => [
      type,
      MEDIA_PLAN_AD_TYPE_COLORS[index % MEDIA_PLAN_AD_TYPE_COLORS.length]!,
    ])
  );
}

function dayTypeColor(type: MediaPlanDayType): string {
  return MEDIA_PLAN_DAY_TYPE_COLORS[type];
}

function calendarSlotLabel(data: MediaPlanData): string {
  if (data.postingSlotCount && data.postingSlotCount !== data.creatorCount) {
    return `${data.postingSlotCount} ad slots · ${data.creatorCount} creators`;
  }
  if (data.postingSlotCount) {
    return `${data.postingSlotCount} deliverables`;
  }
  return `${data.creatorCount} creators`;
}

function renderAvatar(day: Pick<MediaPlanDay, "avatarUrl" | "creator" | "shortName">): string {
  const initials = escapeHtml(initialsFromCreatorName(day.creator ?? day.shortName ?? "?"));
  if (day.avatarUrl) {
    return `<img class="cav" src="${escapeHtml(day.avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'cav',textContent:'${initials}'}))" />`;
  }
  return `<span class="cav">${initials}</span>`;
}

function renderChips(types: string[], typeColorMap: Map<string, string>, fallback: string): string {
  if (!types.length) return "";
  return types
    .map(
      (type) =>
        `<span class="chip"><span class="cdot" style="background:${escapeHtml(typeColorMap.get(type) ?? fallback)}"></span>${escapeHtml(type)}</span>`
    )
    .join("");
}

function renderCreatorCard(
  name: string,
  day: Pick<MediaPlanDay, "avatarUrl" | "creator" | "shortName">,
  types: string[],
  typeColorMap: Map<string, string>,
  fallback: string
): string {
  const displayName = escapeHtml(name);
  const avatarDay = { ...day, creator: name, shortName: name };
  return `<div class="ccard">
    <div class="ccard-top">
      ${renderAvatar(avatarDay)}
      <span class="cname" dir="auto">${displayName}</span>
    </div>
    ${renderChips(types, typeColorMap, fallback)}
  </div>`;
}

function renderDayColumn(
  day: MediaPlanDay,
  dayIndex: number,
  weekNum: number,
  campaignStart: Date,
  typeColorMap: Map<string, string>
): string {
  const fallback = dayTypeColor(day.type);
  const dateStr = day.dateLabel ?? formatDayColumnDate(campaignStart, weekNum, dayIndex);
  const dayAbbr = DAY_ABBR[dayIndex] ?? day.day;

  let cards = "";
  if (day.creator) {
    const primaryTypes =
      day.serviceTypes?.length
        ? day.serviceTypes
        : day.serviceType?.trim()
          ? [day.serviceType]
          : typesForDay(day);
    cards += renderCreatorCard(day.shortName ?? day.creator, day, primaryTypes, typeColorMap, fallback);
    for (const entry of day.additionalDeliverables ?? []) {
      if (entry.isMirror) {
        const mirrorType = entry.serviceType?.trim();
        if (!mirrorType) continue;
        cards += `<div class="mirror-chip">↔ ${escapeHtml(mirrorType)}</div>`;
        continue;
      }
      const entryTypes =
        entry.serviceTypes?.length
          ? entry.serviceTypes
          : entry.serviceType?.trim()
            ? [entry.serviceType]
            : [];
      cards += renderCreatorCard(
        entry.shortName ?? entry.creator ?? "Creator",
        entry,
        entryTypes,
        typeColorMap,
        fallback
      );
    }
  } else {
    const types = typesForDay(day);
    if (types.length) {
      cards = `<div class="ccard ccard--ops">${renderChips(types, typeColorMap, fallback)}</div>`;
    } else if (!isMediaPlanOpenPublishingSlot(day)) {
      cards = `<div class="ccard ccard--ops"><span class="muted">${escapeHtml(day.label)}</span></div>`;
    }
  }

  return `<div class="daycol">
    <div class="daycol-head">
      <span class="dayabbr">${escapeHtml(dayAbbr.toUpperCase())}</span>
      <span class="daydate">${escapeHtml(dateStr)}</span>
    </div>
    <div class="daycol-body">${cards}</div>
  </div>`;
}

function renderWeekBlock(
  week: MediaPlanData["weeks"][number],
  data: MediaPlanData,
  typeColorMap: Map<string, string>
): string {
  const campaignStart = parseCampaignStartDate(data.campaignStartDate);
  const dayCols = week.days
    .map((day, index) => renderDayColumn(day, index, week.week, campaignStart, typeColorMap))
    .join("");

  return `<div class="weekblock">
    <div class="weekblock-head">
      <span class="weeklabel">WEEK ${week.week}</span>
      <span class="weekrange">${escapeHtml(formatWeekRangeLabel(campaignStart, week.week))}</span>
      <span class="weekphase">${escapeHtml(week.phase)} · Wave ${week.wave}</span>
    </div>
    <div class="weekgrid">${dayCols}</div>
  </div>`;
}

function renderSectionHeader(
  label: string,
  title: string,
  options?: BuildMediaPlanHtmlOptions
): string {
  return `<div class="section-header">
    ${mediaPlanLogo(options, "header", "light")}
    <p class="section-label">${escapeHtml(label)}</p>
    <h2 class="section-title">${escapeHtml(title)}</h2>
  </div>`;
}

function renderContextStrip(context?: MediaPlanCampaignContext): string {
  if (!context?.clientName && !context?.brandName && !context?.groupName && !context?.agencyName) {
    return "";
  }

  const fields = [
    context.groupName ? { label: "Group", value: context.groupName } : null,
    context.clientName ? { label: "Legal entity", value: context.clientName } : null,
    context.brandName ? { label: "Brand", value: context.brandName } : null,
    context.agencyName ? { label: "Agency", value: context.agencyName } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return `<dl class="cover-context">${fields
    .map(
      ({ label, value }) =>
        `<div><dt class="cover-context-label">${escapeHtml(label)}</dt><dd class="cover-context-value">${escapeHtml(value)}</dd></div>`
    )
    .join("")}</dl>`;
}

function renderClosePage(
  content: CampaignOutputContent,
  context: MediaPlanCampaignContext | undefined,
  options?: BuildMediaPlanHtmlOptions
): string {
  const label = formatMediaPlanPreparedForLabel(context, content.title);
  return `<div class="mp-page mp-page--close" aria-label="Closing page">
    ${mediaPlanLogo(options, "closing", "dark")}
    <h2 class="close-title">Let's bring it to life.</h2>
    <p class="close-sub">Thinkway Media Plan — prepared exclusively for ${escapeHtml(label)}</p>
    <p class="close-contact">thinkway.com</p>
  </div>`;
}

function renderCoverLegend(data: MediaPlanData): string {
  const legendTypes = collectLegendTypes(data);
  if (!legendTypes.length) return "";

  const typeColorMap = buildAdTypeColorMap(legendTypes);
  const items = legendTypes
    .map(
      (type) =>
        `<div class="legend-item"><span class="dot" style="background:${escapeHtml(typeColorMap.get(type) ?? MEDIA_PLAN_BRAND.muted)}"></span>${escapeHtml(type)}</div>`
    )
    .join("");

  return `<div class="cover-legend">
    <div class="lt">Ad Types</div>
    <div class="legend-grid">${items}</div>
  </div>`;
}

function confidenceBadgeHtml(confidence?: MediaPlanStrategyBlock["confidence"]): string {
  if (!confidence) return "";
  const level = confidence.level;
  return `<span class="confidence-badge confidence-badge--${escapeHtml(level)}" title="${escapeHtml(confidence.reason)}">
    <span class="confidence-badge-label">Confidence</span>
    <span class="confidence-badge-level">${escapeHtml(level.charAt(0).toUpperCase() + level.slice(1))}</span>
    <span class="confidence-badge-reason">${escapeHtml(confidence.reason)}</span>
  </span>`;
}

function tierChipsHtml(chips?: MediaPlanStrategyBlock["tierChips"]): string {
  if (!chips?.length) return "";
  return `<div class="tier-chips">${chips
    .map(
      (chip) =>
        `<span class="tier-chip"><span class="tier-chip-count">${chip.count}</span>${escapeHtml(chip.tier)}</span>`
    )
    .join("")}</div>`;
}

function platformBarsHtml(bars?: MediaPlanStrategyBlock["platformBars"]): string {
  if (!bars?.length) return "";
  return `<div class="strategy-platform-bars">${bars
    .map((entry, index) => {
      const color = PLATFORM_BAR_COLORS[index % PLATFORM_BAR_COLORS.length]!;
      return `<div class="pbar-row">
        <div class="pbar-label"><span>${escapeHtml(entry.platform)}</span><span class="pbar-pct">${entry.percentage}%</span></div>
        <div class="pbar-track"><div class="pbar-fill" style="width:${entry.percentage}%;background:${color}"></div></div>
      </div>`;
    })
    .join("")}</div>`;
}

function weeklyObjectivesGridHtml(objectives?: MediaPlanStrategyBlock["weeklyObjectives"]): string {
  if (!objectives?.length) return "";
  return `<div class="week-obj-grid">${objectives
    .map(
      (week) =>
        `<div class="week-obj-card">
          <div class="week-obj-head">
            <span class="week-obj-num">W${week.week}</span>
            <span class="week-obj-phase">${escapeHtml(week.phase)}</span>
            <span class="week-obj-weight">${week.weight}%</span>
          </div>
          <ul class="week-obj-goals">${week.goals
            .map((goal) => `<li>${escapeHtml(goal)}</li>`)
            .join("")}</ul>
        </div>`
    )
    .join("")}</div>`;
}

function creativeItemsHtml(items?: MediaPlanStrategyBlock["creativeItems"]): string {
  if (!items?.length) return "";
  return `<div class="creative-rec-grid">${items
    .map((entry) => {
      const conf = entry.confidence
        ? `<span class="creative-rec-conf creative-rec-conf--${escapeHtml(entry.confidence)}">${escapeHtml(entry.confidence)}</span>`
        : "";
      return `<div class="creative-rec-card">
        <div class="creative-rec-top">
          <p class="creative-rec-format">${escapeHtml(entry.format)}</p>
          ${conf}
        </div>
        <p class="creative-rec-reason">${escapeHtml(entry.reason)}</p>
      </div>`;
    })
    .join("")}</div>`;
}

function evidenceStripHtml(evidence?: string[]): string {
  if (!evidence?.length) return "";
  return `<div class="strategy-evidence">${evidence
    .map((item) => `<span class="strategy-evidence-chip">${escapeHtml(item)}</span>`)
    .join("")}</div>`;
}

function renderStrategyBlock(block: MediaPlanStrategyBlock): string {
  const badge = confidenceBadgeHtml(block.confidence);
  const limitations = block.limitations
    ? `<p class="strategy-limitations">${escapeHtml(block.limitations)}</p>`
    : "";
  const evidence = evidenceStripHtml(block.evidence);

  let content = "";
  switch (block.kind) {
    case "weekly-grid":
      content = weeklyObjectivesGridHtml(block.weeklyObjectives);
      break;
    case "creative-list":
      content =
        creativeItemsHtml(block.creativeItems) ||
        `<p class="strategy-body">${escapeHtml(block.body).replace(/\n/g, "<br />")}</p>`;
      break;
    case "platform-bars":
      content = `${platformBarsHtml(block.platformBars)}<p class="strategy-body strategy-body--compact">${escapeHtml(block.body).replace(/\n/g, "<br />")}</p>`;
      break;
    case "tier-chips":
      content = `${tierChipsHtml(block.tierChips)}<p class="strategy-body strategy-body--compact">${escapeHtml(block.body).replace(/\n/g, "<br />")}</p>`;
      break;
    default:
      content = `<p class="strategy-body">${escapeHtml(block.body).replace(/\n/g, "<br />")}</p>`;
  }

  return `<div class="strategy-block strategy-block--${escapeHtml(block.kind)}">
    <div class="strategy-block-head">
      <p class="strategy-label">${escapeHtml(block.label)}</p>
      ${badge}
    </div>
    ${evidence}
    ${content}
    ${limitations}
  </div>`;
}

function renderStrategySection(
  data: MediaPlanData,
  options?: BuildMediaPlanHtmlOptions
): string {
  const summary = data.strategySummary;
  if (!summary) return "";

  if (!summary.hasContent) {
    return `${PAGE_BREAK}<section class="mp-section mp-section--strategy">
      ${renderSectionHeader("Campaign Strategy", "Media Plan", options)}
      <div class="strategy-card strategy-card--placeholder">
        <p class="strategy-placeholder">Strategy summary will appear here once the campaign brief or strategy section is complete.</p>
      </div>
    </section>`;
  }

  const blocks = buildMediaPlanStrategyBlocks(summary);

  const blocksHtml = blocks.map((block) => renderStrategyBlock(block)).join("");

  return `${PAGE_BREAK}<section class="mp-section mp-section--strategy">
    ${renderSectionHeader("Campaign Strategy", "Media Plan", options)}
    <div class="strategy-deck">${blocksHtml}</div>
  </section>`;
}

function renderCoverHeader(
  content: CampaignOutputContent,
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined,
  options?: BuildMediaPlanHtmlOptions
): string {
  const cost = context?.campaignCost;
  const costHero = cost
    ? `<div class="cost-hero">
        <div class="lbl">Campaign Cost</div>
        <div class="val">${escapeHtml(formatMoney(cost.amount, cost.currency))}</div>
        <div class="note">${escapeHtml(MEDIA_PLAN_COST_VAT_DISCLAIMER)}</div>
      </div>`
    : "";

  const adSlots = data.postingSlotCount ?? data.creatorCount;

  return `<header class="mp-cover">
    <div class="mp-cover-body">
      ${mediaPlanLogo(options, "cover", "dark")}
      <h1 class="cover-title">${escapeHtml(content.title)}</h1>
      ${content.summary ? `<p class="cover-summary">${escapeHtml(content.summary)}</p>` : ""}
      ${renderContextStrip(context)}
    </div>
    <div class="cover-foot">
      <div class="cover-bottom">
        ${costHero}
        <div class="stat-row">
          <div class="stat-box"><div class="n">${data.durationWeeks}</div><div class="l">Weeks</div></div>
          <div class="stat-box"><div class="n">${adSlots}</div><div class="l">Ad Slots</div></div>
          <div class="stat-box"><div class="n">${data.creatorCount}</div><div class="l">Creators</div></div>
        </div>
      </div>
      ${renderCoverLegend(data)}
    </div>
  </header>`;
}

function renderCalendarSection(
  content: CampaignOutputContent,
  data: MediaPlanData,
  typeColorMap: Map<string, string>,
  legendTypes: string[],
  options?: BuildMediaPlanHtmlOptions
): string {
  const weeksHtml = data.weeks.map((week) => renderWeekBlock(week, data, typeColorMap)).join("");
  const slotLabel = calendarSlotLabel(data);

  const legend = legendTypes.length
    ? `<span class="cal-legend-title">Ad types</span>${legendTypes
        .map(
          (type) =>
            `<span class="legend-chip"><span class="cdot legend-cdot" style="background:${escapeHtml(typeColorMap.get(type) ?? MEDIA_PLAN_BRAND.muted)}"></span>${escapeHtml(type)}</span>`
        )
        .join("")}`
    : "";

  return `<section class="mp-section mp-section--calendar">
    ${renderSectionHeader("Publishing Calendar", content.title, options)}
    <div class="calendar-shell">
      <div class="calendar-toolbar">
        <span class="calendar-badge">${data.durationWeeks} weeks · ${escapeHtml(slotLabel)}</span>
        ${legend}
      </div>
      <div class="calendar-weeks">${weeksHtml}</div>
    </div>
  </section>`;
}

function platformAllocationBars(data: MediaPlanData): Array<{ platform: string; percentage: number }> {
  const entries = Object.entries(data.platformAllocation);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries.map(([platform, count]) => ({
    platform,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

function renderOperationsSection(
  content: CampaignOutputContent,
  data: MediaPlanData,
  options?: BuildMediaPlanHtmlOptions
): string {
  const wavesCard = `<div class="ops-card">
    <h3>Activation Waves</h3>
    <ul class="ops-list">${data.waves
      .map(
        (wave) =>
          `<li><strong>Wave ${wave.wave}</strong> — ${escapeHtml(wave.theme)} <span class="muted">(wk ${wave.weeks.join(", ")})</span></li>`
      )
      .join("")}</ul>
  </div>`;

  const allocationBars = platformAllocationBars(data);
  const platformCard =
    allocationBars.length > 0
      ? `<div class="ops-card">
          <h3>Platform Allocation</h3>
          <div class="platform-bars">${allocationBars
            .map((entry, index) => {
              const color = PLATFORM_BAR_COLORS[index % PLATFORM_BAR_COLORS.length]!;
              return `<div class="pbar-row">
                <div class="pbar-label"><span>${escapeHtml(entry.platform)}</span><span class="pbar-pct">${entry.percentage}%</span></div>
                <div class="pbar-track"><div class="pbar-fill" style="width:${entry.percentage}%;background:${color}"></div></div>
              </div>`;
            })
            .join("")}</div>
        </div>`
      : "";

  const milestonesCard = `<div class="ops-card">
    <h3>Milestones &amp; Windows</h3>
    <ul class="ops-list ops-list--scroll">${data.milestones
      .slice(0, 14)
      .map(
        (milestone) =>
          `<li><span class="mono muted">Wk ${milestone.week}</span> · ${escapeHtml(milestone.label)}</li>`
      )
      .join("")}</ul>
  </div>`;

  const depsCard =
    data.dependencies.length > 0
      ? `<div class="ops-card">
          <h3>Creator Dependencies</h3>
          <ul class="ops-list">${data.dependencies
            .map(
              (dep) =>
                `<li><strong>${escapeHtml(dep.creator)}</strong> <span class="muted">→ ${escapeHtml(dep.dependsOn)}</span></li>`
            )
            .join("")}</ul>
        </div>`
      : "";

  return `<section class="mp-section">
    ${renderSectionHeader("Operations", content.title, options)}
    <div class="ops-body">
      ${wavesCard}
      ${platformCard}
      ${milestonesCard}
      ${depsCard}
    </div>
  </section>`;
}

function renderDeadlinesTableRows(deadlines: MediaPlanData["deadlines"]): string {
  return deadlines
    .map((deadline, index) => {
      const deliverables = deadline.serviceTypes?.length
        ? deadline.serviceTypes
        : deadline.serviceType?.trim()
          ? [deadline.serviceType]
          : [];
      const deliverableHtml = deliverables.length
        ? `<ul class="dl-deliverables">${deliverables.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
        : "—";
      const initials = escapeHtml(initialsFromCreatorName(deadline.shortName ?? deadline.creator));
      const avatar = deadline.avatarUrl
        ? `<img class="dl-avatar" src="${escapeHtml(deadline.avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'dl-avatar dl-avatar--init',textContent:'${initials}'}))" />`
        : `<span class="dl-avatar dl-avatar--init">${initials}</span>`;

      return `<tr class="${index % 2 === 1 ? "dl-row--alt" : ""}">
        <td><div class="dl-creator">${avatar}<div><strong dir="auto">${escapeHtml(deadline.shortName ?? deadline.creator)}</strong>${deadline.handle ? `<span class="muted" dir="auto">@${escapeHtml(deadline.handle.replace(/^@/, ""))}</span>` : ""}</div></div></td>
        <td>${deliverableHtml}</td>
        <td>Week ${deadline.publishWeek} · ${escapeHtml(deadline.publishDay)}</td>
        <td class="muted">${escapeHtml(deadline.productionStart)}</td>
        <td class="muted">${escapeHtml(deadline.assetDelivery)}</td>
      </tr>`;
    })
    .join("");
}

function renderDeadlinesSection(
  content: CampaignOutputContent,
  data: MediaPlanData,
  options?: BuildMediaPlanHtmlOptions
): string {
  if (!data.deadlines.length) return "";

  return `${PAGE_BREAK}<section class="mp-section">
    ${renderSectionHeader(MEDIA_PLAN_DEADLINES_HEADING, content.title, options)}
    <div class="dl-wrap">
      <table class="dl-table">
        <thead><tr>
          <th>Creator</th><th>Deliverables</th><th>Publish</th><th>Production starts</th><th>Assets due</th>
        </tr></thead>
        <tbody>${renderDeadlinesTableRows(data.deadlines)}</tbody>
      </table>
    </div>
  </section>`;
}

function renderExtraSection(section: CampaignOutputContentSection): string {
  const items = section.items?.length
    ? `<ul class="extra-list">${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const body = section.body ? `<p class="extra-body-text">${escapeHtml(section.body).replace(/\n/g, "<br />")}</p>` : "";
  const table = section.table
    ? `<div class="extra-table-wrap"><table class="data-table"><thead><tr>${section.table.columns
        .map((col) => `<th>${escapeHtml(col)}</th>`)
        .join("")}</tr></thead><tbody>${section.table.rows
        .map(
          (row) =>
            `<tr class="data-table-row">${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
        )
        .join("")}</tbody></table></div>`
    : "";

  return `<section class="extra-section">
    <h3 class="extra-heading">${escapeHtml(section.heading)}</h3>
    ${body}${items}${table}
  </section>`;
}

function shouldSkipSection(heading: string, hasDeadlines: boolean): boolean {
  if (heading.startsWith("Week ")) return true;
  if (heading === "Campaign Cost") return true;
  if (hasDeadlines && heading === MEDIA_PLAN_DEADLINES_HEADING) return true;
  return SKIP_SECTION_HEADINGS.has(heading);
}

/** Google Fonts import — matches quotation / IO report exports for PDF + preview. */
const MEDIA_PLAN_FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`;

export function buildMediaPlanStyles(): string {
  return `
    ${MEDIA_PLAN_FONT_IMPORT}
    ${THINKWAY_REPORT_LOGO_STYLES}
    :root {
      --blue: ${MEDIA_PLAN_BRAND.electricBlue};
      --navy: ${MEDIA_PLAN_BRAND.deepNavy};
      --lavender: ${MEDIA_PLAN_BRAND.lavender};
      --ink: ${MEDIA_PLAN_BRAND.ink};
      --muted: ${MEDIA_PLAN_BRAND.muted};
      --gradient: ${MEDIA_PLAN_BRAND.gradient};
      --rule: rgba(11,15,26,0.10);
      --rule-light: rgba(11,15,26,0.06);
    }
    * { box-sizing: border-box; }
    @page { size: ${MEDIA_PLAN_PAGE.widthIn} ${MEDIA_PLAN_PAGE.heightIn}; margin: 0; }
    html, body { width: 100%; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      color: var(--ink);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .mp-doc {
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 24px;
      background: #fff;
    }
    .mp-page {
      break-after: page;
      page-break-after: always;
    }
    .mp-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .mp-section {
      margin-bottom: 32px;
    }
    .mp-page-break {
      break-before: page;
      page-break-before: always;
      height: 0;
      margin: 0;
    }

    @media print {
      .mp-page-break {
        break-before: page;
        page-break-before: always;
      }
    }

    /* Cover */
    .mp-page--cover {
      margin: -32px -24px 0;
    }
    .mp-cover {
      margin-bottom: 0;
      overflow: hidden;
      border-radius: 16px;
      color: #fff;
      background: var(--gradient);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      break-inside: avoid;
      page-break-inside: avoid;
      min-height: 100%;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .mp-cover-body { padding: 32px 40px 0; flex: 1; }
    .mp-cover-body .thinkway-report-logo {
      margin-bottom: 4px;
    }
    .cover-title {
      margin: 16px 0 0;
      font-size: 64px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.02;
    }
    .cover-summary {
      margin: 18px 0 0;
      font-size: 17px;
      line-height: 1.5;
      color: rgba(255,255,255,0.82);
      max-width: 40rem;
    }
    .cover-context {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      margin: 16px 0 0;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.15);
    }
    .cover-context-label {
      margin: 0;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.7);
    }
    .cover-context-value {
      margin: 2px 0 0;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
    }
    .cover-foot {
      margin-top: auto;
      padding: 0 40px 32px;
    }
    .cover-bottom {
      display: flex;
      gap: 20px;
      align-items: stretch;
    }
    .cost-hero {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 20px;
      padding: 26px 32px;
      min-width: 340px;
    }
    .cost-hero .lbl {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.65);
      font-weight: 700;
    }
    .cost-hero .val {
      font-size: 40px;
      font-weight: 800;
      margin-top: 8px;
      letter-spacing: -0.01em;
      color: #fff;
    }
    .cost-hero .note {
      font-size: 11.5px;
      color: rgba(255,255,255,0.55);
      margin-top: 6px;
    }
    .stat-row {
      display: flex;
      gap: 14px;
      flex: 1;
    }
    .stat-box {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 16px;
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .stat-box .n {
      font-size: 30px;
      font-weight: 800;
      color: #fff;
      line-height: 1;
    }
    .stat-box .l {
      font-size: 12px;
      color: rgba(255,255,255,0.65);
      margin-top: 4px;
      font-weight: 600;
    }
    .cover-legend { margin-top: 26px; }
    .cover-legend .lt {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.6);
      font-weight: 700;
      margin-bottom: 12px;
    }
    .legend-grid {
      display: grid;
      grid-template-columns: repeat(5, auto);
      gap: 10px 22px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      color: rgba(255,255,255,0.88);
      font-weight: 500;
    }
    .legend-item .dot {
      width: 9px;
      height: 9px;
      border-radius: 3px;
      display: inline-block;
      flex-shrink: 0;
    }

    /* Section headers */
    .section-header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--rule-light);
    }
    .section-header .thinkway-report-logo {
      margin-bottom: 4px;
    }
    .section-label {
      margin: 4px 0 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .section-title {
      margin: 2px 0 0;
      font-size: 20px;
      font-weight: 800;
      color: var(--ink);
      letter-spacing: -0.02em;
    }

    /* Strategy — presentation deck */
    .strategy-deck {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .strategy-block {
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--rule-light);
      background: linear-gradient(160deg, #fff 0%, #fafbff 100%);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .strategy-block--executive,
    .strategy-block--weekly-grid,
    .strategy-block--creative-list {
      grid-column: 1 / -1;
    }
    .strategy-block-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .strategy-card {
      padding: 18px 20px;
      border-radius: 16px;
      border: 1px solid var(--rule-light);
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .strategy-card--placeholder {
      background: #fafbff;
    }
    .strategy-placeholder {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: var(--muted);
    }
    .strategy-label {
      margin: 0;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--navy);
    }
    .strategy-body {
      margin: 0;
      font-size: 12px;
      line-height: 1.55;
      color: var(--ink);
    }
    .strategy-body--compact {
      margin-top: 10px;
      font-size: 11.5px;
      color: #374151;
    }
    .strategy-limitations {
      margin: 10px 0 0;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(245,158,11,0.08);
      border: 1px solid rgba(245,158,11,0.2);
      font-size: 10.5px;
      line-height: 1.45;
      color: #92400e;
    }
    .confidence-badge {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 1px;
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid var(--rule-light);
      background: #fff;
      flex-shrink: 0;
      max-width: 11rem;
    }
    .confidence-badge-label {
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .confidence-badge-level {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .confidence-badge--high .confidence-badge-level { color: #1D9E75; }
    .confidence-badge--medium .confidence-badge-level { color: #D97706; }
    .confidence-badge--low .confidence-badge-level { color: #DC2626; }
    .confidence-badge-reason {
      font-size: 8px;
      line-height: 1.3;
      color: var(--muted);
      text-align: right;
    }
    .strategy-evidence {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .strategy-evidence-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(0,87,255,0.06);
      border: 1px solid rgba(0,87,255,0.12);
      font-size: 9px;
      font-weight: 600;
      color: var(--blue);
    }
    .tier-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 4px;
    }
    .tier-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--navy);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .tier-chip-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      border-radius: 999px;
      background: rgba(255,255,255,0.18);
      font-size: 9px;
      font-weight: 800;
    }
    .strategy-platform-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 2px;
    }
    .week-obj-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .week-obj-card {
      padding: 10px;
      border-radius: 10px;
      border: 1px solid var(--rule-light);
      background: #fff;
    }
    .week-obj-head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .week-obj-num {
      font-size: 11px;
      font-weight: 800;
      color: var(--blue);
    }
    .week-obj-phase {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--navy);
    }
    .week-obj-weight {
      margin-left: auto;
      font-size: 10px;
      font-weight: 800;
      color: var(--ink);
    }
    .week-obj-goals {
      margin: 0;
      padding: 0 0 0 14px;
      font-size: 9.5px;
      line-height: 1.4;
      color: #374151;
    }
    .week-obj-goals li { margin-bottom: 2px; }
    .creative-rec-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .creative-rec-card {
      padding: 10px;
      border-radius: 10px;
      border: 1px solid var(--rule-light);
      background: #fff;
      border-top: 3px solid var(--blue);
    }
    .creative-rec-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
    }
    .creative-rec-format {
      margin: 0;
      font-size: 10.5px;
      font-weight: 800;
      color: var(--navy);
      line-height: 1.25;
    }
    .creative-rec-reason {
      margin: 0;
      font-size: 9.5px;
      line-height: 1.4;
      color: var(--muted);
    }
    .creative-rec-conf {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 6px;
      border-radius: 999px;
      flex-shrink: 0;
    }
    .creative-rec-conf--high { background: rgba(29,158,117,0.12); color: #1D9E75; }
    .creative-rec-conf--medium { background: rgba(217,119,6,0.12); color: #D97706; }
    .creative-rec-conf--low { background: rgba(220,38,38,0.1); color: #DC2626; }

    /* Calendar */
    .calendar-shell {
      padding: 16px 20px;
      border-radius: 16px;
      border: 1px solid var(--rule-light);
      background: var(--lavender);
    }
    .calendar-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .calendar-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      background: var(--gradient);
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }
    .cal-legend-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--navy);
    }
    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 12rem;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid rgba(11,15,26,0.08);
      background: #fff;
      font-size: 12px;
      font-weight: 500;
      color: var(--ink);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .legend-cdot { width: 8px; height: 8px; }
    .calendar-weeks { display: flex; flex-direction: column; gap: 20px; }
    .weekblock {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .weekblock-head {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .weeklabel {
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--blue);
    }
    .weekrange {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
    }
    .weekphase {
      font-size: 10px;
      color: var(--muted);
      margin-left: auto;
    }
    .weekgrid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
    }
    .daycol {
      background: #fff;
      border-radius: 10px;
      border: 1px solid var(--rule-light);
      overflow: hidden;
      min-width: 0;
      min-height: 5.5rem;
      display: flex;
      flex-direction: column;
    }
    .daycol-head {
      padding: 4px 8px;
      background: rgba(0,87,255,0.06);
      border-bottom: 1px solid rgba(11,15,26,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .dayabbr {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: var(--blue);
    }
    .daydate {
      font-size: 8.5px;
      font-weight: 600;
      color: var(--muted);
    }
    .daycol-body { padding: 4px; display: flex; flex: 1; flex-direction: column; gap: 4px; }
    .ccard {
      padding: 6px;
      border-radius: 8px;
      border: 1px solid var(--rule-light);
      background: #fafbff;
    }
    .ccard--ops {
      background: #fff;
      min-height: 2.5rem;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }
    .mirror-chip {
      padding: 4px 6px;
      border-radius: 6px;
      border: 1px dashed var(--rule-light);
      background: rgba(255,255,255,0.85);
      font-size: 7px;
      font-weight: 600;
      color: var(--muted);
    }
    .ccard-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .cav {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--lavender);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 6.6px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--blue);
      flex-shrink: 0;
      object-fit: cover;
    }
    .cname {
      font-size: 8.3px;
      font-weight: 700;
      line-height: 1.15;
      color: var(--ink);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 7.4px;
      font-weight: 500;
      color: var(--muted);
      margin-right: 4px;
      margin-bottom: 2px;
    }
    .cdot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }

    /* Operations */
    .ops-body {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .ops-card {
      border: 1px solid var(--rule);
      border-radius: 14px;
      padding: 16px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .ops-card h3 {
      margin: 0 0 14px;
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }
    .ops-list {
      margin: 0;
      padding: 0 0 0 16px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.5;
      color: var(--ink);
    }
    .ops-list li { margin-bottom: 4px; }
    @media screen {
      .ops-list--scroll { max-height: 12rem; overflow: auto; }
    }
    .platform-bars { display: flex; flex-direction: column; gap: 10px; }
    .pbar-label {
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      font-weight: 700;
      margin-bottom: 4px;
      color: var(--ink);
    }
    .pbar-pct { color: var(--ink); font-size: 12px; font-weight: 800; }
    .pbar-track {
      height: 6px;
      border-radius: 999px;
      background: var(--lavender);
      overflow: hidden;
    }
    .pbar-fill { height: 100%; border-radius: 999px; }

    /* Deadlines */
    .dl-wrap {
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid var(--rule);
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .dl-table {
      width: 100%;
      min-width: 32rem;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    .dl-table thead { display: table-header-group; }
    .dl-table thead tr { background: var(--navy); color: #fff; }
    .dl-table tbody tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .dl-table tbody td {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .dl-table th {
      padding: 10px 12px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .dl-table td {
      padding: 9px 12px;
      border-top: 1px solid var(--rule-light);
      vertical-align: top;
      color: var(--ink);
    }
    .dl-row--alt td { background: rgba(232,239,254,0.35); }
    .dl-creator { display: flex; align-items: center; gap: 8px; }
    .dl-creator strong { display: block; font-size: 10.5px; font-weight: 700; }
    .dl-creator .muted { display: block; font-size: 9px; font-weight: 500; }
    .dl-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: var(--lavender);
    }
    .dl-avatar--init {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      color: var(--blue);
    }
    .dl-deliverables { margin: 0; padding: 0; list-style: none; font-size: 9.5px; line-height: 1.4; color: var(--muted); }

    /* Extra sections */
    .mp-extras { display: flex; flex-direction: column; gap: 24px; }
    .extra-section {
      break-inside: avoid;
      page-break-inside: avoid;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(11,15,26,0.06);
    }
    .extra-section:last-child { border-bottom: 0; }
    .extra-heading {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--blue);
    }
    .extra-body-text {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: rgba(11,15,26,0.9);
      white-space: pre-wrap;
    }
    .extra-list {
      margin: 8px 0 0;
      padding: 0 0 0 20px;
      font-size: 13px;
      line-height: 1.55;
      color: rgba(11,15,26,0.9);
    }
    .extra-table-wrap {
      margin-top: 8px;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid rgba(11,15,26,0.08);
    }
    .data-table {
      width: 100%;
      min-width: 32rem;
      border-collapse: collapse;
      font-size: 12px;
    }
    .data-table th, .data-table td {
      border-top: 1px solid rgba(11,15,26,0.06);
      padding: 8px 12px;
      text-align: left;
    }
    .data-table th {
      background: rgba(11,15,26,0.04);
      color: var(--muted);
      font-weight: 600;
    }
    .data-table-row td { color: rgba(11,15,26,0.9); }

    .muted { color: var(--muted); }
    .mono { font-family: 'Courier New', monospace; }

    /* Close page */
    .mp-page--close {
      break-before: page;
      page-break-before: always;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #fff;
      background-color: ${MEDIA_PLAN_BRAND.deepNavy};
      background-image:
        radial-gradient(circle at 80% 85%, rgba(26,111,255,0.3), transparent 45%),
        ${MEDIA_PLAN_BRAND.gradientAccent};
      min-height: ${MEDIA_PLAN_PAGE.heightPx}px;
      padding: 48px 24px;
    }
    .close-title {
      margin: 0;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .close-sub {
      margin: 14px 0 0;
      font-size: 14px;
      color: rgba(255,255,255,0.75);
      max-width: 28rem;
    }
    .close-contact {
      margin: 44px 0 0;
      font-size: 12px;
      color: rgba(255,255,255,0.6);
      letter-spacing: 0.06em;
    }

    @media screen {
      .mp-page + .mp-page {
        margin-top: 32px;
      }
      .mp-page--close {
        border-radius: 16px;
        overflow: hidden;
      }
    }

    @media print {
      .mp-doc {
        max-width: none;
        padding: 0;
        box-shadow: none;
      }
      .mp-page--cover {
        margin: 0;
        min-height: ${MEDIA_PLAN_PAGE.heightPx}px;
        height: ${MEDIA_PLAN_PAGE.heightPx}px;
      }
      .mp-doc > :not(.mp-page--cover):not(.mp-page--close) {
        padding-left: 24px;
        padding-right: 24px;
      }
      .mp-doc > .mp-section--calendar {
        padding-top: 20px;
      }
      .mp-cover {
        border-radius: 0;
        min-height: ${MEDIA_PLAN_PAGE.heightPx}px;
        height: 100%;
        box-shadow: none;
      }
      .mp-page--close {
        border-radius: 0;
        margin: 0;
        width: 100%;
        min-height: ${MEDIA_PLAN_PAGE.heightPx}px;
        height: ${MEDIA_PLAN_PAGE.heightPx}px;
      }
      .mp-section { margin-bottom: 24px; }
      .mp-section--calendar { margin-bottom: 20px; }
      .calendar-shell,
      .daycol,
      .ccard,
      .ops-card,
      .dl-wrap,
      .legend-chip,
      .calendar-badge,
      .mp-cover {
        box-shadow: none;
      }
      .calendar-shell,
      .daycol,
      .ccard,
      .ops-card,
      .dl-wrap,
      .legend-chip,
      .extra-table-wrap {
        border-color: var(--rule);
      }
      .daycol-head {
        border-bottom-color: rgba(11,15,26,0.12);
      }
      .section-header,
      .extra-section {
        border-bottom-color: var(--rule);
      }
      .dl-table td,
      .data-table th,
      .data-table td {
        border-top-color: var(--rule);
      }
    }
  `;
}

function buildMediaPlanBody(
  content: CampaignOutputContent,
  data: MediaPlanData,
  options?: BuildMediaPlanHtmlOptions
): string {
  const context = mergeMediaPlanContext(data.campaignContext, options?.contextOverride);
  const legendTypes = collectLegendTypes(data);
  const typeColorMap = buildAdTypeColorMap(legendTypes);
  const hasDeadlines = Boolean(data.deadlines.length);

  const extraSections = content.sections.filter(
    (section) => !shouldSkipSection(section.heading, hasDeadlines)
  );

  const cover = renderCoverHeader(content, data, context, options);
  const strategy = renderStrategySection(data, options);
  const calendar = renderCalendarSection(content, data, typeColorMap, legendTypes, options);
  const operations = renderOperationsSection(content, data, options);
  const deadlines = renderDeadlinesSection(content, data, options);
  const extras = extraSections.length
    ? `<div class="mp-extras">${extraSections.map(renderExtraSection).join("")}</div>`
    : "";

  const close = renderClosePage(content, context, options);

  return `<article class="mp-doc">
    <div class="mp-page mp-page--cover">${cover}</div>
    ${strategy}
    ${calendar}
    ${operations}
    ${deadlines}
    ${extras}
    ${close}
  </article>`;
}

/** Markup for embedding in the in-app preview panel (styles + body). */
export function buildMediaPlanPreviewMarkup(
  content: CampaignOutputContent,
  options?: BuildMediaPlanHtmlOptions
): string {
  if (!isMediaPlanContent(content)) {
    throw new Error("Media Plan preview requires structured calendar data.");
  }

  return `<style>${buildMediaPlanStyles()}</style>${buildMediaPlanBody(content, content.data, options)}`;
}

/** Build a standalone HTML document for Media Plan preview / PDF / download. */
export function buildMediaPlanHtml(
  content: CampaignOutputContent,
  options?: BuildMediaPlanHtmlOptions
): string {
  if (!isMediaPlanContent(content)) {
    throw new Error("Media Plan export requires structured calendar data.");
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${MEDIA_PLAN_PAGE.widthPx}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <title>${escapeHtml(content.title)} — Thinkway</title>
  <style>${buildMediaPlanStyles()}</style>
</head>
<body>
  ${buildMediaPlanBody(content, content.data, options)}
</body>
</html>`;
}
