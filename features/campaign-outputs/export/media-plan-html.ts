/**
 * Media Plan HTML — client-facing document for preview, PDF (puppeteer), and download.
 */
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";

import type { CampaignOutputContent, CampaignOutputContentSection } from "../output-types";
import type { MediaPlanData, MediaPlanDay, MediaPlanDayType } from "../generators/media-plan";
import { MEDIA_PLAN_AD_TYPE_COLORS, MEDIA_PLAN_BRAND, MEDIA_PLAN_DAY_TYPE_COLORS } from "../components/media-plan-brand";
import { isMediaPlanContent } from "./media-plan-export-utils";

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const GENERIC_OPERATIONAL_TYPES = new Set([
  "Stories",
  "Paid amplification",
  "Reporting",
  "Stories slot",
  "Performance review",
]);

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typesForDay(day: MediaPlanDay): string[] {
  if (day.serviceTypes?.length) return day.serviceTypes;
  if (day.serviceType?.trim()) return [day.serviceType];
  return [];
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

function renderAvatar(day: MediaPlanDay): string {
  const initials = escapeHtml(initialsFromCreatorName(day.creator ?? day.shortName ?? "?"));
  if (day.avatarUrl) {
    return `<img class="cell-avatar" src="${escapeHtml(day.avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'cell-avatar cell-avatar--initials',textContent:'${initials}'}))" />`;
  }
  return `<span class="cell-avatar cell-avatar--initials">${initials}</span>`;
}

function labelFromDay(day: MediaPlanDay): string {
  return escapeHtml(day.shortName ?? day.creator ?? "");
}

function renderCalendarCell(day: MediaPlanDay, typeColorMap: Map<string, string>): string {
  const types = typesForDay(day);
  const dotColor = types.length
    ? typeColorMap.get(types[0]!) ?? dayTypeColor(day.type)
    : dayTypeColor(day.type);

  const typeList = types.length
    ? `<ul class="cell-types">${types
        .map(
          (type) =>
            `<li><span class="dot" style="background:${escapeHtml(typeColorMap.get(type) ?? dotColor)}"></span>${escapeHtml(type)}</li>`
        )
        .join("")}</ul>`
    : `<span class="cell-label">${escapeHtml(day.label)}</span>`;

  const body = day.creator
    ? `<div class="cell-creator">${renderAvatar(day)}<div class="cell-copy"><strong>${labelFromDay(day)}</strong>${typeList}</div></div>`
    : `<div class="cell-operational"><span class="dot" style="background:${escapeHtml(dotColor)}"></span>${typeList}</div>`;

  return `<td class="calendar-cell">${day.dateLabel ? `<span class="cell-date">${escapeHtml(day.dateLabel)}</span>` : ""}${body}</td>`;
}

function renderCalendar(data: MediaPlanData): string {
  const legendTypes = collectLegendTypes(data);
  const typeColorMap = buildAdTypeColorMap(legendTypes);
  const slotLabel =
    data.postingSlotCount && data.postingSlotCount !== data.creatorCount
      ? `${data.postingSlotCount} ad slots · ${data.creatorCount} creators`
      : `${data.creatorCount} creators`;

  const legend = legendTypes.length
    ? `<div class="legend">${legendTypes
        .map(
          (type) =>
            `<span class="legend-chip"><span class="dot" style="background:${escapeHtml(typeColorMap.get(type) ?? MEDIA_PLAN_BRAND.muted)}"></span>${escapeHtml(type)}</span>`
        )
        .join("")}</div>`
    : "";

  const rows = data.weeks
    .map((week) => {
      const dayCells = week.days.map((day) => renderCalendarCell(day, typeColorMap)).join("");
      return `<tr>
        <th class="week-label"><span class="week-num">Week ${week.week}</span><span class="week-phase">${escapeHtml(week.phase)}</span><span class="week-wave">Wave ${week.wave}</span></th>
        ${dayCells}
      </tr>`;
    })
    .join("");

  return `<section class="calendar-wrap">
    <div class="calendar-meta">
      <span class="pill">${data.durationWeeks} weeks · ${escapeHtml(slotLabel)}</span>
      ${legendTypes.length ? `<span class="legend-title">Ad types</span>` : ""}
      ${legend}
    </div>
    <table class="calendar">
      <thead><tr><th>Week</th>${DAY_ABBR.map((day) => `<th>${day}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="calendar-foot">
      <div class="foot-card">
        <h3>Activation Waves</h3>
        <ul>${data.waves
          .map(
            (wave) =>
              `<li><strong>Wave ${wave.wave}</strong> — ${escapeHtml(wave.theme)} <span class="muted">(wk ${wave.weeks.join(", ")})</span></li>`
          )
          .join("")}</ul>
      </div>
      <div class="foot-card">
        <h3>Milestones &amp; Windows</h3>
        <ul>${data.milestones
          .slice(0, 12)
          .map(
            (milestone) =>
              `<li><span class="mono muted">Wk ${milestone.week}</span> · ${escapeHtml(milestone.label)}</li>`
          )
          .join("")}</ul>
      </div>
    </div>
  </section>`;
}

function renderSection(section: CampaignOutputContentSection): string {
  const items = section.items?.length
    ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const body = section.body ? `<p>${escapeHtml(section.body).replace(/\n/g, "<br />")}</p>` : "";
  const table = section.table
    ? `<table class="data-table"><thead><tr>${section.table.columns
        .map((col) => `<th>${escapeHtml(col)}</th>`)
        .join("")}</tr></thead><tbody>${section.table.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
        )
        .join("")}</tbody></table>`
    : "";

  return `<section class="doc-section">
    <h2>${escapeHtml(section.heading)}</h2>
    ${body}
    ${items}
    ${table}
  </section>`;
}

function renderCampaignContext(data: MediaPlanData): string {
  const ctx = data.campaignContext;
  if (!ctx?.brandName && !ctx?.groupName && !ctx?.agencyName) return "";

  const chips: string[] = [];
  if (ctx.groupName) chips.push(`<span class="context-chip"><span class="context-label">Group</span>${escapeHtml(ctx.groupName)}</span>`);
  if (ctx.brandName) chips.push(`<span class="context-chip"><span class="context-label">Brand</span>${escapeHtml(ctx.brandName)}</span>`);
  if (ctx.agencyName) chips.push(`<span class="context-chip"><span class="context-label">Agency</span>${escapeHtml(ctx.agencyName)}</span>`);

  return `<div class="context-row">${chips.join("")}</div>`;
}

function buildMediaPlanStyles(): string {
  return `
    :root {
      --electric: ${MEDIA_PLAN_BRAND.electricBlue};
      --navy: ${MEDIA_PLAN_BRAND.deepNavy};
      --lavender: ${MEDIA_PLAN_BRAND.lavender};
      --ink: ${MEDIA_PLAN_BRAND.ink};
      --muted: ${MEDIA_PLAN_BRAND.muted};
      --gradient: ${MEDIA_PLAN_BRAND.gradient};
    }
    * { box-sizing: border-box; }
    @page { size: A4 landscape; margin: 10mm; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: var(--ink);
      background: var(--lavender);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px 32px 40px;
    }
    .doc-header {
      background: #fff;
      border: 1px solid rgba(11, 15, 26, 0.08);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(6, 8, 16, 0.06);
      margin-bottom: 28px;
    }
    .doc-header-bar { height: 6px; background: var(--gradient); }
    .doc-header-body { padding: 20px 24px 22px; }
    .brand-mark {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: var(--electric);
      margin: 0;
    }
    .doc-title {
      margin: 8px 0 0;
      font-size: 28px;
      font-weight: 800;
      color: var(--navy);
      letter-spacing: -0.02em;
    }
    .doc-summary {
      margin: 10px 0 0;
      font-size: 14px;
      line-height: 1.55;
      color: var(--muted);
    }
    .context-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .context-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(11, 15, 26, 0.08);
      background: var(--lavender);
      font-size: 11px;
      font-weight: 600;
      color: var(--ink);
    }
    .context-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--electric);
    }
    .calendar-wrap {
      background: var(--lavender);
      border: 1px solid rgba(11, 15, 26, 0.06);
      border-radius: 16px;
      padding: 18px 20px 20px;
      margin-bottom: 28px;
    }
    .calendar-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
    }
    .pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: var(--gradient);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
    }
    .legend-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--navy);
    }
    .legend { display: flex; flex-wrap: wrap; gap: 6px; }
    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 12rem;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid rgba(11, 15, 26, 0.08);
      background: #fff;
      font-size: 10px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }
    table.calendar {
      width: 100%;
      border-collapse: separate;
      border-spacing: 6px;
      table-layout: fixed;
    }
    table.calendar th {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--navy);
      text-align: center;
      padding: 0 2px 4px;
    }
    table.calendar th.week-label {
      width: 5.5rem;
      text-align: left;
      vertical-align: middle;
      padding: 8px 10px;
      border-radius: 12px;
      background: var(--gradient);
      color: #fff;
    }
    .week-num { display: block; font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; }
    .week-phase { display: block; font-size: 10px; font-weight: 500; opacity: 0.85; margin-top: 2px; }
    .week-wave { display: block; font-size: 9px; opacity: 0.65; margin-top: 2px; }
    .calendar-cell {
      vertical-align: top;
      min-height: 5rem;
      padding: 6px;
      border-radius: 12px;
      border: 1px solid rgba(11, 15, 26, 0.08);
      background: #fff;
      font-size: 10px;
      line-height: 1.35;
    }
    .cell-date {
      display: block;
      font-family: ui-monospace, monospace;
      font-size: 9px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .cell-creator { display: flex; gap: 6px; align-items: flex-start; }
    .cell-copy { min-width: 0; }
    .cell-copy strong {
      display: block;
      font-size: 10px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell-types {
      margin: 4px 0 0;
      padding: 0;
      list-style: none;
    }
    .cell-types li {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell-operational {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 9px;
      min-height: 3rem;
    }
    .cell-label { color: var(--muted); font-size: 9px; }
    .cell-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: var(--lavender);
    }
    .cell-avatar--initials {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      color: var(--electric);
    }
    .calendar-foot {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .foot-card {
      background: #fff;
      border: 1px solid rgba(11, 15, 26, 0.08);
      border-radius: 12px;
      overflow: hidden;
    }
    .foot-card h3 {
      margin: 0;
      padding: 10px 12px 0;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--electric);
    }
    .foot-card ul {
      margin: 0;
      padding: 8px 12px 12px 24px;
      font-size: 12px;
      line-height: 1.45;
    }
    .doc-section {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 22px;
      padding-bottom: 18px;
      border-bottom: 1px solid rgba(11, 15, 26, 0.08);
    }
    .doc-section:last-child { border-bottom: 0; }
    .doc-section h2 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--electric);
    }
    .doc-section p, .doc-section li {
      font-size: 13px;
      line-height: 1.55;
      color: rgba(11, 15, 26, 0.9);
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 12px;
    }
    .data-table th, .data-table td {
      border: 1px solid rgba(11, 15, 26, 0.08);
      padding: 8px 10px;
      text-align: left;
    }
    .data-table th { background: rgba(11, 15, 26, 0.04); color: var(--muted); }
    .muted { color: var(--muted); }
    .mono { font-family: ui-monospace, monospace; }
  `;
}

/** Build a standalone HTML document for Media Plan preview / PDF / download. */
export function buildMediaPlanHtml(content: CampaignOutputContent): string {
  if (!isMediaPlanContent(content)) {
    throw new Error("Media Plan export requires structured calendar data.");
  }

  const data = content.data;
  const sections = content.sections
    .filter((section) => !section.heading.startsWith("Week "))
    .map(renderSection)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.title)} — Thinkway</title>
  <style>${buildMediaPlanStyles()}</style>
</head>
<body>
  <main class="page">
    <header class="doc-header">
      <div class="doc-header-bar"></div>
      <div class="doc-header-body">
        <p class="brand-mark">Thinkway</p>
        <h1 class="doc-title">${escapeHtml(content.title)}</h1>
        ${content.summary ? `<p class="doc-summary">${escapeHtml(content.summary)}</p>` : ""}
        ${renderCampaignContext(data)}
      </div>
    </header>
    <h2 style="margin:0 0 12px;font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--navy);">Publishing Calendar</h2>
    ${renderCalendar(data)}
    ${sections}
  </main>
</body>
</html>`;
}
