import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  applyFactsToSummaryData,
  buildCreatorMixFromFacts,
  getCampaignFacts,
  resolveFactsCurrency,
  resolveFactsDurationWeeks,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { SHORTLIST_PALETTE } from "@/features/discovery/shortlists/export/shortlist-document-styles";
import {
  renderThinkwayReportLogoHtml,
  THINKWAY_REPORT_LOGO_STYLES,
} from "@/lib/reports/document/thinkway-report-logo";

import {
  resolveCampaignSummary,
  resolveExecutiveStrategy,
  resolveExecutiveSummaryData,
  resolveBudgetData,
  resolveKpiData,
  resolvePresentationData,
  resolvePresentationCompletion,
} from "../services/section-data-resolver";
import { buildCreatorContentIdea, isTrendCampaign } from "../services/creator-slate";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ProposalVendor = {
  displayName: string;
  handle?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  avatarUrl?: string;
  tier?: string;
  reason?: string;
  contentIdea?: string;
};

export type ProposalBranding = {
  /** Client logo URL from the client master — monogram fallback when absent. */
  clientLogoUrl?: string;
};

/**
 * Tier palette for charts and chips — validated with the dataviz six-checks
 * (lightness band, chroma floor, adjacent-pair CVD ΔE 24.9, contrast ≥3:1).
 * Every segment/chip is direct-labeled, so identity is never color-alone.
 */
const TIER_COLORS: Record<string, { fill: string; chipBg: string; chipText: string }> = {
  Celebrity: { fill: "#D97706", chipBg: "rgba(217,119,6,.12)", chipText: "#92400E" },
  Macro: { fill: "#6366F1", chipBg: "rgba(99,102,241,.12)", chipText: "#3730A3" },
  "Mid-Tier": { fill: "#1D9E75", chipBg: "rgba(29,158,117,.12)", chipText: "#0F6E50" },
  Micro: { fill: "#8B5CF6", chipBg: "rgba(139,92,246,.12)", chipText: "#5B21B6" },
  Nano: { fill: "#0284C7", chipBg: "rgba(2,132,199,.12)", chipText: "#075985" },
  Unknown: { fill: "#94A3B8", chipBg: "#F1F5F9", chipText: "#475569" },
};

function tierColor(tier?: string): { fill: string; chipBg: string; chipText: string } {
  const key = (tier ?? "").trim();
  const exact = TIER_COLORS[key];
  if (exact) return exact;
  const norm = key.toLowerCase();
  if (norm.startsWith("celebrity") || norm.startsWith("mega")) return TIER_COLORS.Celebrity!;
  if (norm.startsWith("macro")) return TIER_COLORS.Macro!;
  if (norm.startsWith("mid")) return TIER_COLORS["Mid-Tier"]!;
  if (norm.startsWith("micro")) return TIER_COLORS.Micro!;
  if (norm.startsWith("nano")) return TIER_COLORS.Nano!;
  return TIER_COLORS.Unknown!;
}

function tierChip(tier?: string): string {
  const label = tier?.trim() || "Unclassified";
  const c = tierColor(tier);
  return `<span class="tier-chip" style="background:${c.chipBg};color:${c.chipText};border:1px solid ${c.fill}33">${escapeHtml(label)}</span>`;
}

function avatarHtml(vendor: ProposalVendor): string {
  const initial = (vendor.displayName.trim()[0] ?? "?").toUpperCase();
  if (vendor.avatarUrl?.trim()) {
    return `<span class="avatar"><img src="${escapeHtml(vendor.avatarUrl)}" alt="" onerror="this.parentNode.textContent='${escapeHtml(initial)}'" /></span>`;
  }
  return `<span class="avatar avatar--initial">${escapeHtml(initial)}</span>`;
}

function formatCompact(value?: number): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString();
}

/** Creator rows for the proposal — hydrated vendors first, section reasoning as fallback. */
function resolveProposalVendors(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[]
): ProposalVendor[] {
  if (hydratedVendors.length > 0) return hydratedVendors;

  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const reasoning: VendorSelectedReasoning[] =
    creatorsData.recommendations?.selectedReasoning ?? [];

  return reasoning
    .filter((r) => r.displayName?.trim())
    .map((r) => ({
      displayName: r.displayName!.trim(),
      reason: r.whySelected,
      tier: r.expectedRole,
    }));
}

/** Activation waves: tier order over the campaign window sustains trend momentum. */
function buildActivationWaves(
  campaignObject: CampaignObject
): Array<{ window: string; wave: string; goal: string; tier?: string }> {
  const facts = getCampaignFacts(campaignObject);
  if (!facts) return [];

  const weeks = resolveFactsDurationWeeks(facts);
  const mix = buildCreatorMixFromFacts(facts);
  const trend = isTrendCampaign(facts);

  const waves: Array<{ wave: string; goal: string; tier?: string }> = mix.map((tier) => ({
    wave: `${tier.tier} creators · ${tier.percent}%`,
    goal: tier.reasoning,
    tier: tier.tier,
  }));
  if (trend) {
    waves.push({
      wave: "UGC competition + best-video spotlight",
      goal: "Convert audience participation into a self-sustaining trend",
    });
  }

  const windowWeeks = Math.max(1, Math.floor(weeks / Math.max(waves.length, 1)));
  let start = 1;
  return waves.map((w, index) => {
    const end = index === waves.length - 1 ? weeks : Math.min(weeks, start + windowWeeks - 1);
    const window = start === end ? `Week ${start}` : `Weeks ${start}–${end}`;
    start = end + 1;
    return { window, ...w };
  });
}

const TREND_AMPLIFICATION = [
  ["⚡", "TikTok Spark Ads on top creator posts — reactive boost within 24h of a spike"],
  ["#️⃣", "Official hashtag challenge with the campaign sound pinned"],
  ["🔁", "Duet and stitch chains seeded between anchor creators"],
  ["🏆", "Best-video competition converting viewers into participants"],
  ["⭐", "Celebrity reposts of standout community videos"],
  ["📣", "Official brand account reshares top UGC daily during peak weeks"],
] as const;

const GENERIC_AMPLIFICATION = [
  ["⚡", "Paid boost on top-performing creator posts"],
  ["🔁", "Cross-posting of best content to brand channels"],
  ["🤝", "Creator collaboration formats (duets, joint posts) to pool audiences"],
] as const;

/** Client-facing campaign proposal — CIO/VIO document language: ink headings, navy cover, green accents only. */
export function buildCampaignProposalDocumentHtml(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = [],
  branding: ProposalBranding = {}
): string {
  const P = SHORTLIST_PALETTE;
  const generated = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const facts = getCampaignFacts(campaignObject);
  // Facts fill any gap the persisted summary cards leave (legacy objects included).
  const resolvedSummary = resolveCampaignSummary(campaignObject);
  const summary = facts
    ? { ...applyFactsToSummaryData({}, facts), ...(resolvedSummary ?? {}) }
    : resolvedSummary;
  const strategy = resolveExecutiveStrategy(campaignObject);
  const budget = resolveBudgetData(campaignObject);
  const executive = resolveExecutiveSummaryData(campaignObject);
  const presentation = resolvePresentationData(campaignObject);
  const kpis = resolveKpiData(campaignObject);
  const presentationVersion = resolvePresentationCompletion(campaignObject).version;

  const client = summary?.client ?? presentation?.brandName ?? "Client";
  const brand = presentation?.brandName ?? summary?.brand ?? client;
  const campaignName = presentation?.campaignName ?? `${brand} Campaign Proposal`;
  const trend = isTrendCampaign(facts);
  const currency = facts ? resolveFactsCurrency(facts) : "USD";

  const clientMark = branding.clientLogoUrl?.trim()
    ? `<img class="client-logo" src="${escapeHtml(branding.clientLogoUrl)}" alt="${escapeHtml(client)}" />`
    : `<span class="client-monogram">${escapeHtml((client.trim()[0] ?? "C").toUpperCase())}</span>`;

  const vendors = resolveProposalVendors(campaignObject, hydratedVendors);

  // ---- Stat tiles (hero numbers — form: stat tile, not a chart) ----
  const statTiles = [
    facts?.budget
      ? { label: "Budget", value: `${formatCompact(facts.budget.amount)} ${currency}`, sub: "100% influencer fees" }
      : null,
    { label: "Duration", value: summary?.duration ?? "—", sub: "client-facing window" },
    vendors.length > 0
      ? { label: "Creators", value: String(vendors.length), sub: "recommended slate" }
      : null,
    summary?.estimatedReach
      ? { label: "Est. reach", value: summary.estimatedReach.split(" ")[0] ?? summary.estimatedReach, sub: "projected impressions" }
      : null,
  ]
    .filter(Boolean)
    .map(
      (t) => `
      <div class="stat">
        <div class="stat-label">${escapeHtml(t!.label)}</div>
        <div class="stat-value">${escapeHtml(t!.value)}</div>
        <div class="stat-sub">${escapeHtml(t!.sub)}</div>
      </div>`
    )
    .join("");

  // ---- Understanding grid ----
  const understandingRows = [
    ["Client", summary?.client],
    ["Brand", summary?.brand],
    ["Product", summary?.product],
    ["Market", summary?.market],
    ["Objective", summary?.objective],
    ["Audience", summary?.targetAudience],
    ["Platforms", summary?.platforms],
    ["Deliverables", summary?.deliverables],
  ]
    .filter(([, value]) => value?.toString().trim())
    .map(
      ([label, value]) => `
      <div class="fact">
        <div class="fact-label">${escapeHtml(String(label))}</div>
        <div class="fact-value">${escapeHtml(String(value))}</div>
      </div>`
    )
    .join("");

  // ---- Tier mix proportional bar (identity, ≤5 categories, direct-labeled) ----
  const mixCounts = new Map<string, number>();
  for (const v of vendors) {
    const key = tierColor(v.tier) === TIER_COLORS.Unknown ? "Unclassified" : v.tier!.trim();
    mixCounts.set(key, (mixCounts.get(key) ?? 0) + 1);
  }
  const strategyMix = facts ? buildCreatorMixFromFacts(facts) : [];
  const mixSource: Array<{ tier: string; count: number; percent: number }> =
    mixCounts.size > 0
      ? [...mixCounts.entries()].map(([tier, count]) => ({
          tier,
          count,
          percent: Math.round((count / vendors.length) * 100),
        }))
      : strategyMix.map((t) => ({ tier: t.tier, count: t.count, percent: t.percent }));

  const tierBar =
    mixSource.length > 0
      ? `<div class="tier-bar">${mixSource
          .map((m) => {
            const c = tierColor(m.tier);
            return `<div class="tier-seg" style="flex:${Math.max(m.percent, 4)};background:${c.fill}" title="${escapeHtml(m.tier)} ${m.percent}%"></div>`;
          })
          .join("")}</div>
        <div class="tier-legend">${mixSource
          .map((m) => {
            const c = tierColor(m.tier);
            return `<span class="tier-legend-item"><span class="dot" style="background:${c.fill}"></span>${escapeHtml(m.tier)} · ${m.count} creator${m.count === 1 ? "" : "s"} · ${m.percent}%</span>`;
          })
          .join("")}</div>`
      : "";

  // ---- Creator table with avatars, auto tier, content concepts ----
  const vendorRows =
    vendors.length > 0
      ? vendors
          .map((v, i) => {
            const idea =
              v.contentIdea ??
              buildCreatorContentIdea({ categories: [v.reason ?? ""] }, facts, i);
            return `
        <tr>
          <td class="creator-cell">${avatarHtml(v)}<div><strong>${escapeHtml(v.displayName)}</strong>${
            v.handle ? `<div class="muted">@${escapeHtml(v.handle.replace(/^@/, ""))}</div>` : ""
          }</div></td>
          <td>${tierChip(v.tier)}</td>
          <td>${escapeHtml(v.platform ?? "—")}</td>
          <td class="num">${formatCompact(v.followers)}</td>
          <td class="num">${v.engagementRate != null ? `${v.engagementRate.toFixed(1)}%` : "—"}</td>
          <td class="muted">${escapeHtml(v.reason ?? "")}</td>
          <td class="muted">${escapeHtml(idea)}</td>
        </tr>`;
          })
          .join("")
      : `<tr><td colspan="7" class="muted">Creator slate pending discovery run.</td></tr>`;

  // ---- Momentum stepper ----
  const waves = buildActivationWaves(campaignObject);
  const waveSteps = waves
    .map((w, i) => {
      const c = w.tier ? tierColor(w.tier) : { fill: P.accent };
      return `
      <div class="wave">
        <div class="wave-num" style="background:${c.fill}">${i + 1}</div>
        <div class="wave-body">
          <div class="wave-window">${escapeHtml(w.window)}</div>
          <div class="wave-title">${escapeHtml(w.wave)}</div>
          <div class="muted">${escapeHtml(w.goal)}</div>
        </div>
      </div>`;
    })
    .join("");

  // ---- Budget: single allocation → stat treatment; multi → labeled bars ----
  const allocations = budget?.allocations ?? [];
  const budgetBlock = budget
    ? allocations.length <= 1
      ? `<div class="budget-hero">
           <div class="budget-hero-num">100%</div>
           <div>
             <div class="budget-hero-title">${escapeHtml(allocations[0]?.category ?? "Creator fees")} — ${escapeHtml(budget.currency ?? currency)} ${budget.total?.toLocaleString() ?? "—"}</div>
             <div class="muted">${escapeHtml(allocations[0]?.notes ?? "Influencer campaign model: production embedded in creator fees.")}</div>
           </div>
         </div>`
      : `<p><strong>Total:</strong> ${escapeHtml(budget.currency ?? currency)} ${budget.total?.toLocaleString() ?? "—"}</p>
         <div class="alloc-bars">${allocations
           .map(
             (a) => `
           <div class="alloc">
             <div class="alloc-head"><span>${escapeHtml(a.category)}</span><span class="num">${a.percent ?? 0}%</span></div>
             <div class="alloc-track"><div class="alloc-fill" style="width:${Math.min(a.percent ?? 0, 100)}%"></div></div>
             ${a.notes ? `<div class="muted">${escapeHtml(a.notes)}</div>` : ""}
           </div>`
           )
           .join("")}</div>`
    : `<p class="muted">Budget to be confirmed with client.</p>`;

  const kpiItems = Array.isArray(kpis) ? [] : (kpis?.kpis ?? []);
  const kpiRows = kpiItems
    .slice(0, 8)
    .map(
      (k) =>
        `<tr><td><strong>${escapeHtml(k.metric)}</strong></td><td>${escapeHtml(k.target ?? "")}</td><td class="muted">${escapeHtml(k.benchmark ?? k.platform ?? "")}</td></tr>`
    )
    .join("");

  const amplification = (trend ? TREND_AMPLIFICATION : GENERIC_AMPLIFICATION)
    .map(
      ([icon, item]) =>
        `<div class="amp"><span class="amp-icon">${icon}</span><span>${escapeHtml(item)}</span></div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(campaignName)} — Thinkway</title>
  <style>
    ${THINKWAY_REPORT_LOGO_STYLES}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: ${P.ink}; background: #fff; font-size: 12px; line-height: 1.55; }
    .muted { color: ${P.muted}; font-size: 11px; }
    .num { font-variant-numeric: tabular-nums; }

    /* Cover — navy, matching CIO/VIO document language */
    .cover { background: ${P.primary}; color: #fff; min-height: 100vh; padding: 52px; display: flex; flex-direction: column; justify-content: space-between; }
    .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .cover h1 { font-size: 34px; font-weight: 700; margin-top: 40px; max-width: 640px; letter-spacing: -0.01em; }
    .cover .goal { margin-top: 18px; font-size: 15px; opacity: 0.92; max-width: 560px; }
    .cover .kicker { color: ${P.accent}; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .cover .meta { opacity: 0.8; font-size: 11px; margin-top: 28px; }
    .client-logo { max-height: 44px; max-width: 140px; object-fit: contain; background: #fff; border-radius: 10px; padding: 6px 10px; }
    .client-monogram { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: #fff; color: ${P.primary}; font-size: 20px; font-weight: 700; }

    .page { max-width: 210mm; margin: 0 auto; padding: 36px 42px; }
    h2 { font-size: 15px; color: ${P.ink}; margin: 30px 0 12px; padding-bottom: 7px; border-bottom: 1px solid ${P.rule}; display: flex; align-items: center; gap: 8px; }
    h2::after { content: ""; flex: 0 0 34px; height: 3px; background: ${P.accent}; border-radius: 2px; margin-left: auto; }
    h2 .sticker { font-size: 15px; }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 18px; }
    .stat { border: 1px solid ${P.rule}; border-left: 3px solid ${P.accent}; border-radius: 10px; padding: 12px 14px; background: ${P.card}; }
    .stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${P.muted}; }
    .stat-value { font-size: 22px; font-weight: 700; color: ${P.ink}; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .stat-sub { font-size: 10px; color: ${P.muted}; margin-top: 2px; }

    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    .fact { border-bottom: 1px dashed ${P.rule}; padding-bottom: 8px; }
    .fact-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${P.muted}; }
    .fact-value { margin-top: 2px; color: ${P.ink}; }

    .tier-bar { display: flex; gap: 2px; height: 18px; border-radius: 6px; overflow: hidden; margin: 10px 0 8px; }
    .tier-seg { min-width: 8px; }
    .tier-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: ${P.ink}; }
    .tier-legend-item { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }

    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { text-align: left; background: ${P.card}; padding: 8px; border-bottom: 1px solid ${P.rule}; vertical-align: top; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: ${P.muted}; }
    td { padding: 8px; border-bottom: 1px solid ${P.rule}; vertical-align: top; }
    .creator-cell { display: flex; gap: 8px; align-items: center; min-width: 150px; }
    .avatar { width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex: 0 0 30px; background: ${P.accentLight}; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: ${P.accent}; border: 1px solid ${P.rule}; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .tier-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; white-space: nowrap; }

    .waves { margin-top: 12px; display: grid; gap: 0; }
    .wave { display: flex; gap: 12px; padding: 10px 0; position: relative; }
    .wave:not(:last-child)::before { content: ""; position: absolute; left: 13px; top: 38px; bottom: -4px; width: 2px; background: ${P.rule}; }
    .wave-num { width: 28px; height: 28px; border-radius: 50%; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: 0 0 28px; font-size: 12px; }
    .wave-window { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${P.muted}; }
    .wave-title { font-weight: 600; color: ${P.ink}; }

    .budget-hero { display: flex; gap: 16px; align-items: center; border: 1px solid ${P.rule}; border-radius: 12px; padding: 16px; background: ${P.card}; }
    .budget-hero-num { font-size: 34px; font-weight: 700; color: ${P.accent}; font-variant-numeric: tabular-nums; }
    .budget-hero-title { font-weight: 600; color: ${P.ink}; }
    .alloc { margin-bottom: 10px; }
    .alloc-head { display: flex; justify-content: space-between; font-weight: 600; }
    .alloc-track { height: 10px; border-radius: 5px; background: ${P.rule}; margin: 4px 0; overflow: hidden; }
    .alloc-fill { height: 100%; border-radius: 5px; background: ${P.accent}; }

    .amps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-top: 8px; }
    .amp { display: flex; gap: 8px; align-items: flex-start; }
    .amp-icon { flex: 0 0 18px; }

    .footer { margin-top: 44px; padding-top: 14px; border-top: 1px solid ${P.rule}; font-size: 10px; color: ${P.muted}; display: flex; justify-content: space-between; }
    @media print { .cover { page-break-after: always; } h2 { page-break-after: avoid; } tr, .wave, .stat { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="cover-top">
        ${renderThinkwayReportLogoHtml({ variant: "cover", theme: "dark" })}
        ${clientMark}
      </div>
      <div class="kicker" style="margin-top:48px">Campaign Intelligence Proposal</div>
      <h1>${escapeHtml(campaignName)}</h1>
      ${summary?.objective ? `<p class="goal">${escapeHtml(summary.objective)}</p>` : ""}
      <p class="meta">Prepared for ${escapeHtml(client)} · ${escapeHtml(generated)}</p>
    </div>
    <p class="meta">Confidential — for client review only</p>
  </section>

  <div class="page">
    <div class="stats">${statTiles}</div>

    <h2><span class="sticker">🎯</span>Campaign Understanding</h2>
    <div class="facts">${understandingRows}</div>

    <h2><span class="sticker">🧠</span>Executive Summary</h2>
    <p>${escapeHtml(executive?.summary ?? summary?.objective ?? "Campaign proposal prepared by Thinkway.")}</p>
    ${executive?.recommendedActions?.length ? `<ul style="margin:6px 0 0 18px">${executive.recommendedActions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>` : ""}

    <h2><span class="sticker">🧭</span>Strategy</h2>
    <p>${escapeHtml(strategy?.creatorStrategy ?? strategy?.objective ?? strategy?.keyMessage ?? "Strategy aligned to brief objectives and audience.")}</p>

    <h2><span class="sticker">🚀</span>Activation Plan — Momentum Waves</h2>
    <p class="muted">Staggered creator waves keep the campaign trending instead of peaking on day one.</p>
    <div class="waves">${waveSteps || `<p class="muted">Timeline pending.</p>`}</div>

    <h2><span class="sticker">👥</span>Recommended Creators &amp; Content Concepts</h2>
    ${tierBar}
    <table>
      <thead>
        <tr><th>Creator</th><th>Tier</th><th>Platform</th><th>Followers</th><th>ER</th><th>Why selected</th><th>Content concept</th></tr>
      </thead>
      <tbody>${vendorRows}</tbody>
    </table>

    <h2><span class="sticker">💰</span>Budget</h2>
    ${budgetBlock}

    <h2><span class="sticker">📣</span>Amplification Recommendations</h2>
    <div class="amps">${amplification}</div>

    ${kpiRows ? `<h2><span class="sticker">📈</span>Success Metrics</h2><table><thead><tr><th>Metric</th><th>Target</th><th>Basis</th></tr></thead><tbody>${kpiRows}</tbody></table>` : ""}

    <div class="footer">
      <span>Generated by Thinkway Platform · ${escapeHtml(generated)}</span>
      <span>Document ref ${escapeHtml(presentationVersion)}</span>
    </div>
  </div>
</body>
</html>`;
}

/** Open proposal preview in a new browser tab (print / Save as PDF). */
export function openCampaignProposalPreview(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = [],
  branding: ProposalBranding = {}
): void {
  const html = buildCampaignProposalDocumentHtml(campaignObject, hydratedVendors, branding);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Re-export for components that hydrate vendors client-side
export { resolveCreatorIds } from "../services/section-data-resolver";
