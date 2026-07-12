import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  applyFactsToSummaryData,
  buildCreatorMixFromFacts,
  getCampaignFacts,
  resolveFactsBrandName,
  resolveFactsClientName,
  resolveFactsCurrency,
  resolveFactsDurationWeeks,
} from "@/features/campaign-director/facts/facts-display-bridge";
import {
  renderThinkwayReportLogoHtml,
  THINKWAY_REPORT_LOGO_STYLES,
} from "@/lib/reports/document/thinkway-report-logo";
import { SLIDE_DECK_PAGE } from "@/lib/io/slide-deck-page";

import {
  resolveCampaignSummary,
  resolveExecutiveStrategy,
  resolveExecutiveSummaryData,
  resolveBudgetData,
  resolveGroundedKpis,
  resolveKpiData,
  resolvePresentationData,
  resolvePresentationCompletion,
  resolveVendorRecommendations,
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
 * Tier palette for chips and dots — mirrors the reference proposal deck
 * (blue/purple/amber/pink/green family). Every chip is direct-labeled,
 * so identity is never color-alone.
 */
const TIER_COLORS: Record<string, { fill: string; chipBg: string; chipText: string }> = {
  Celebrity: { fill: "#D97706", chipBg: "#FFE9CC", chipText: "#B45309" },
  Macro: { fill: "#0057FF", chipBg: "#DDEBFF", chipText: "#0057FF" },
  "Mid-Tier": { fill: "#D6336C", chipBg: "#FFE0EC", chipText: "#D6336C" },
  Micro: { fill: "#7C3AED", chipBg: "#E6DFFF", chipText: "#7C3AED" },
  Nano: { fill: "#0C9D57", chipBg: "#DDF7E8", chipText: "#0C9D57" },
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
  return `<span class="tier-chip" style="background:${c.chipBg};color:${c.chipText}">${escapeHtml(label)}</span>`;
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

  const fromReasoning = reasoning
    .filter((r) => r.displayName?.trim())
    .map((r) => ({
      displayName: r.displayName!.trim(),
      reason: r.whySelected,
      tier: r.expectedRole,
    }));
  if (fromReasoning.length > 0) return fromReasoning;

  const parsed = resolveVendorRecommendations(campaignObject);
  return parsed.map((v) => ({
    displayName: v.displayName,
    handle: v.handle,
    platform: v.platform,
    reason: v.reason,
  }));
}

/** Budget rationale is stored as an internal audit trail — strip that wording for clients. */
function clientFacingAllocationNote(note?: string): string | undefined {
  if (!note?.includes("CampaignFacts")) return note;
  const stripped = note
    .replace(/\s*—\s*influencer-only default:.*$/i, "")
    .replace(/^100% Creator Fees — brief and CampaignFacts[^.]*\.\s*/i, "")
    .trim();
  return stripped || "Production is embedded in creator fees — a single influencer investment line.";
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

export type CampaignProposalModel = {
  campaignName: string;
  client: string;
  brand: string;
  generated: string;
  presentationVersion: string;
  trend: boolean;
  currency: string;
  clientLogoUrl?: string;
  objective?: string;
  executiveSummary: string;
  recommendedActions: string[];
  strategyText: string;
  statTiles: Array<{ label: string; value: string; sub: string }>;
  understanding: Array<[string, string]>;
  vendors: ProposalVendor[];
  mixSource: Array<{ tier: string; count: number; percent: number }>;
  waves: Array<{ window: string; wave: string; goal: string; tier?: string }>;
  budget: {
    total?: number;
    currency: string;
    allocations: Array<{ category: string; percent?: number; notes?: string }>;
  } | null;
  amplification: Array<readonly [string, string]>;
  kpis: Array<{ metric: string; target: string; basis: string }>;
};

function readPlainSectionText(content: string | Record<string, unknown>): string | undefined {
  if (typeof content !== "string") return undefined;
  const trimmed = content.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) return undefined;
  return trimmed;
}

function appendUnderstandingField(
  rows: Array<[string, string]>,
  label: string,
  value?: string | null
): void {
  const text = value?.toString().trim();
  if (!text) return;
  if (rows.some(([existing]) => existing === label)) return;
  rows.push([label, text]);
}

/** Shared proposal data model — consumed by the HTML document and the PPTX deck. */
export function buildCampaignProposalModel(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = [],
  branding: ProposalBranding = {}
): CampaignProposalModel {
  const generated = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const facts = getCampaignFacts(campaignObject);
  const resolvedSummary = resolveCampaignSummary(campaignObject);
  const summary = facts
    ? { ...applyFactsToSummaryData({}, facts), ...(resolvedSummary ?? {}) }
    : resolvedSummary ?? (facts ? applyFactsToSummaryData({}, facts) : null);
  const strategy = resolveExecutiveStrategy(campaignObject);
  const budget = resolveBudgetData(campaignObject);
  const executive = resolveExecutiveSummaryData(campaignObject);
  const presentation = resolvePresentationData(campaignObject);
  const kpis = resolveKpiData(campaignObject);
  const presentationVersion = resolvePresentationCompletion(campaignObject).version;
  const summaryText = readPlainSectionText(campaignObject.sections.summary.content);
  const strategyTextContent = readPlainSectionText(campaignObject.sections.strategy.content);

  const client =
    summary?.client ??
    (facts ? resolveFactsClientName(facts) : undefined) ??
    presentation?.brandName ??
    "Client";
  const brand =
    summary?.brand ??
    (facts ? resolveFactsBrandName(facts) : undefined) ??
    presentation?.brandName ??
    client;
  const campaignName = presentation?.campaignName ?? `${brand} Campaign Proposal`;
  const trend = isTrendCampaign(facts);
  const currency = facts ? resolveFactsCurrency(facts) : "USD";

  const vendors = resolveProposalVendors(campaignObject, hydratedVendors).map((v, i) => ({
    ...v,
    contentIdea:
      v.contentIdea ?? buildCreatorContentIdea({ categories: [v.reason ?? ""] }, facts, i),
  }));

  const statTiles = [
    facts?.budget
      ? { label: "Budget", value: `${formatCompact(facts.budget.amount)} ${currency}`, sub: "100% influencer fees" }
      : budget?.total
        ? {
            label: "Budget",
            value: `${formatCompact(budget.total)} ${budget.currency ?? currency}`,
            sub: "100% influencer fees",
          }
        : null,
    {
      label: "Duration",
      value:
        summary?.duration ??
        (facts ? `${resolveFactsDurationWeeks(facts)} weeks` : undefined) ??
        "—",
      sub: "client-facing window",
    },
    vendors.length > 0
      ? { label: "Creators", value: String(vendors.length), sub: "recommended slate" }
      : null,
    summary?.estimatedReach
      ? { label: "Est. reach", value: summary.estimatedReach.split(" ")[0] ?? summary.estimatedReach, sub: "projected impressions" }
      : null,
  ].filter((t): t is { label: string; value: string; sub: string } => Boolean(t));

  const understanding: Array<[string, string]> = [];
  appendUnderstandingField(understanding, "Client", client);
  appendUnderstandingField(understanding, "Brand", brand);
  appendUnderstandingField(understanding, "Product", summary?.product);
  appendUnderstandingField(understanding, "Market", summary?.market);
  appendUnderstandingField(
    understanding,
    "Objective",
    summary?.objective ?? strategy?.objective ?? facts?.objective
  );
  appendUnderstandingField(
    understanding,
    "Audience",
    summary?.targetAudience ?? strategy?.targetAudience ?? facts?.audience
  );
  appendUnderstandingField(
    understanding,
    "Platforms",
    summary?.platforms ?? facts?.platforms?.join(", ")
  );
  appendUnderstandingField(understanding, "Deliverables", summary?.deliverables);
  if (facts?.geography?.length) {
    appendUnderstandingField(understanding, "Geography", facts.geography.join(", "));
  }
  if (facts?.campaignType) {
    appendUnderstandingField(understanding, "Campaign type", facts.campaignType);
  }

  const executiveSummary =
    executive?.summary?.trim() ||
    summary?.objective?.trim() ||
    strategy?.keyMessage?.trim() ||
    strategy?.creatorStrategy?.trim() ||
    summaryText ||
    strategyTextContent ||
    "Campaign proposal prepared by Thinkway.";

  const strategyText =
    strategy?.creatorStrategy?.trim() ||
    strategy?.objective?.trim() ||
    strategy?.keyMessage?.trim() ||
    strategyTextContent ||
    executiveSummary;

  const recommendedFromExecutive =
    executive?.recommendedActions?.filter((item) => item.trim()) ?? [];
  const recommendedActions =
    recommendedFromExecutive.length > 0
      ? recommendedFromExecutive
      : strategy?.successFactors?.filter((item) => item.trim()) ?? [];

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

  const kpiItems = Array.isArray(kpis) ? [] : (kpis?.kpis ?? []);
  // Grounded KPIs (facts-derived) keep the export complete for legacy objects.
  const kpiRows: Array<{ metric: string; target: string; basis: string }> =
    kpiItems.length > 0
      ? kpiItems.slice(0, 8).map((k) => ({
          metric: k.metric,
          target: k.target ?? "",
          basis: k.benchmark ?? k.platform ?? "",
        }))
      : resolveGroundedKpis(campaignObject)
          .slice(0, 8)
          .map((k) => ({
            metric: k.metric,
            target: k.prediction,
            basis: k.benchmark ?? k.platform ?? k.calculationSource,
          }));

  return {
    campaignName,
    client,
    brand,
    generated,
    presentationVersion,
    trend,
    currency,
    clientLogoUrl: branding.clientLogoUrl,
    objective: summary?.objective ?? facts?.objective ?? strategy?.objective,
    executiveSummary,
    recommendedActions,
    strategyText,
    statTiles,
    understanding,
    vendors,
    mixSource,
    waves: buildActivationWaves(campaignObject),
    budget: budget
      ? {
          total: budget.total,
          currency: budget.currency ?? currency,
          allocations: (budget.allocations ?? []).map((a) => ({
            category: a.category,
            percent: a.percent,
            notes: clientFacingAllocationNote(a.notes),
          })),
        }
      : null,
    amplification: [...(trend ? TREND_AMPLIFICATION : GENERIC_AMPLIFICATION)],
    kpis: kpiRows,
  };
}

// ---------------------------------------------------------------------------
// Proposal deck HTML — 1280×720 landscape pages mirroring the reference design
// (dark gradient cover, per-section pages with eyebrow icons, blue/purple
// accents, dark close page). Render with preferCSSPageSize for PDF.
// ---------------------------------------------------------------------------

const DECK = {
  blue: "#0057FF",
  navy: "#060810",
  ink: "#0B0F1A",
  muted: "#6B7280",
  green: "#0C9D57",
  purple: "#7C3AED",
  amber: "#D97706",
  pink: "#D6336C",
} as const;

/** Timeline dot colors, positional — matches the reference activation page. */
const WAVE_DOT_COLORS = ["#D97706", "#0057FF", "#7C3AED", "#0891B2", "#0C9D57", "#D6336C"];

const CONTACT_LINE =
  "Thinkway · 44B Saraya Mall, Sheikh Zayed, Giza, Egypt · hello@thinkwaymedia.com";

function deckIcon(path: string, size = 17): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const ICONS = {
  grid: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/>`,
  star: `<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6z"/>`,
  zap: `<path d="M13 2L3 14h7l-1 8 11-13h-7l1-7z"/>`,
  users: `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>`,
  coin: `<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5"/>`,
  chart: `<path d="M3 3v18h18M7 15l4-6 3 3 5-7"/>`,
  check: `<path d="M20 6L9 17l-5-5"/>`,
  repeat: `<path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/>`,
  hash: `<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/>`,
  send: `<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>`,
} as const;

/** Amplification bullets carry emoji in the shared model — map to line icons for the deck. */
function ampIconSvg(emoji: string): string {
  const map: Record<string, string> = {
    "⚡": ICONS.zap,
    "#️⃣": ICONS.hash,
    "🔁": ICONS.repeat,
    "🏆": ICONS.star,
    "⭐": ICONS.star,
    "📣": ICONS.send,
    "🤝": ICONS.users,
  };
  return deckIcon(map[emoji] ?? ICONS.check, 13);
}

function deckBrandHeader(sectionNumber: number, client: string): string {
  const logo = renderThinkwayReportLogoHtml({ variant: "header", theme: "light", showText: false });
  return `
    <div class="pg-head">
      <div class="brand">${logo}<span class="tag">Thinkway · Campaign Intelligence</span></div>
      <div class="tag">${String(sectionNumber).padStart(2, "0")} / ${escapeHtml(client)}</div>
    </div>`;
}

function deckFooter(pageNumber: number, client: string): string {
  return `<div class="pg-foot"><span>Thinkway · Campaign Intelligence Proposal</span><b>${escapeHtml(client)} · Confidential</b><span>${String(pageNumber).padStart(2, "0")}</span></div>`;
}

function deckEyebrow(icon: string, color: string, bg: string, title: string): string {
  return `
    <div class="sec-eyebrow">
      <div class="ic" style="background:${bg};color:${color};">${icon}</div>
      <h1>${escapeHtml(title)}</h1>
    </div>`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Anchor vs trend-wave grouping for the strategy band on the summary page. */
export function buildProposalStrategyTags(
  mixSource: Array<{ tier: string; count: number; percent: number }>
): Array<{ n: string; l: string }> {
  const isAnchor = (tier: string) => /celebrity|mega|macro|mid/i.test(tier);
  const anchors = mixSource.filter((m) => isAnchor(m.tier));
  const waves = mixSource.filter((m) => !isAnchor(m.tier) && m.tier !== "Unclassified");
  const tags: Array<{ n: string; l: string }> = [];
  if (anchors.length > 0) {
    tags.push({ n: anchors.map((m) => m.tier).join(" + "), l: "Anchor waves" });
  }
  if (waves.length > 0) {
    tags.push({ n: waves.map((m) => m.tier).join(" / "), l: "Trend waves" });
  }
  return tags;
}

/** Closing-page headline shared by the PDF document and PPTX deck. */
export function buildProposalCloseHeadline(model: CampaignProposalModel): string {
  return model.trend
    ? `Let's turn ${model.brand}'s campaign into the moment everyone's talking about.`
    : `Let's bring the ${model.brand} campaign to life.`;
}

/** Client-facing campaign proposal deck — 1280×720 pages, one section per page. */
export function buildCampaignProposalDocumentHtml(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = [],
  branding: ProposalBranding = {}
): string {
  const model = buildCampaignProposalModel(campaignObject, hydratedVendors, branding);
  const facts = getCampaignFacts(campaignObject);
  const {
    campaignName,
    client,
    generated,
    presentationVersion,
    waves,
    understanding,
    statTiles,
    vendors,
  } = model;

  const clientNameSize = client.length <= 8 ? 104 : client.length <= 16 ? 72 : 48;
  const clientMark = model.clientLogoUrl?.trim()
    ? `<img class="client-logo" src="${escapeHtml(model.clientLogoUrl)}" alt="${escapeHtml(client)}" />`
    : "";

  const pages: string[] = [];
  let sectionNumber = 0;

  // ---- Cover ----
  pages.push(`
  <div class="page cover">
    <div class="cover-inner">
      <div class="cover-top">
        ${renderThinkwayReportLogoHtml({ variant: "cover", theme: "dark" })}
        <div class="cover-top-right">${clientMark}<div class="cover-tag">Campaign Intelligence Proposal</div></div>
      </div>
      <div class="cover-client" style="font-size:${clientNameSize}px;">${escapeHtml(client)}</div>
      ${model.objective ? `<p class="cover-obj">${escapeHtml(model.objective)}</p>` : `<p class="cover-obj">${escapeHtml(campaignName)}</p>`}
      <div class="cover-meta">
        <div>Prepared for<b>${escapeHtml(client)} · ${escapeHtml(generated)}</b></div>
        <div>Status<b>Confidential — client review only</b></div>
        <div>Document ref<b>${escapeHtml(presentationVersion)}</b></div>
      </div>
    </div>
  </div>`);

  // ---- Campaign Understanding ----
  sectionNumber += 1;
  const statBoxes = statTiles
    .map(
      (t) =>
        `<div class="stat-box"><div class="l">${escapeHtml(t.label)}</div><div class="v">${escapeHtml(t.value)}</div><div class="s">${escapeHtml(t.sub)}</div></div>`
    )
    .join("");
  const understandingRows: Array<[string, string]> =
    understanding.length > 0
      ? understanding
      : [["Overview", model.executiveSummary]];
  const understandingPages = chunk(understandingRows, 6);
  understandingPages.forEach((pageFields, pageIndex) => {
    const detailItems = pageFields
      .map(
        ([label, value]) =>
          `<div class="detail-item"><div class="l">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`
      )
      .join("");
    const title =
      understandingPages.length > 1
        ? `Campaign Understanding (${pageIndex + 1}/${understandingPages.length})`
        : "Campaign Understanding";
    pages.push(`
  <div class="page">
    ${deckBrandHeader(sectionNumber, client)}
    ${deckEyebrow(deckIcon(ICONS.grid), DECK.blue, "rgba(0,87,255,.1)", title)}
    ${pageIndex === 0 && statBoxes ? `<div class="stat-grid">${statBoxes}</div>` : ""}
    <div class="detail-grid">${detailItems}</div>
    ${deckFooter(pages.length + 1, client)}
  </div>`);
  });

  // ---- Executive Summary ----
  sectionNumber += 1;
  const checkItems = model.recommendedActions
    .slice(0, 6)
    .map(
      (a) =>
        `<div class="check-item"><span class="ck">${deckIcon(ICONS.check, 12)}</span>${escapeHtml(a)}</div>`
    )
    .join("");
  const strategyTags = buildProposalStrategyTags(model.mixSource)
    .map(
      (t) =>
        `<div class="strategy-tag"><div class="n">${escapeHtml(t.n)}</div><div class="l">${escapeHtml(t.l)}</div></div>`
    )
    .join("");
  const strategyPara =
    model.strategyText && model.strategyText !== model.executiveSummary
      ? `<p class="summary-text" style="padding-top:14px;">${escapeHtml(model.strategyText)}</p>`
      : "";
  pages.push(`
  <div class="page">
    ${deckBrandHeader(sectionNumber, client)}
    ${deckEyebrow(deckIcon(ICONS.star), DECK.pink, "rgba(214,51,108,.1)", "Executive Summary")}
    <p class="summary-text">${escapeHtml(model.executiveSummary)}</p>
    ${checkItems ? `<div class="check-grid">${checkItems}</div>` : strategyPara}
    ${strategyTags ? `<div class="strategy-row">${strategyTags}</div>` : ""}
    ${deckFooter(pages.length + 1, client)}
  </div>`);

  // ---- Activation Plan ----
  if (waves.length > 0) {
    sectionNumber += 1;
    const timelineItems = waves
      .map((w, i) => {
        const color = WAVE_DOT_COLORS[i % WAVE_DOT_COLORS.length];
        return `<div class="t-item"><div class="t-dot" style="background:${color};">${i + 1}</div><div><h4>${escapeHtml(w.window)} — ${escapeHtml(w.wave)}</h4><p>${escapeHtml(w.goal)}</p></div></div>`;
      })
      .join("");
    pages.push(`
  <div class="page">
    ${deckBrandHeader(sectionNumber, client)}
    ${deckEyebrow(deckIcon(ICONS.zap), DECK.green, "rgba(12,157,87,.1)", "Activation Plan — Momentum Waves")}
    <p class="sec-sub">Staggered creator waves keep the campaign trending instead of peaking on day one.</p>
    <div class="timeline">${timelineItems}</div>
    ${deckFooter(pages.length + 1, client)}
  </div>`);
  }

  // ---- Creators (8 rows per page) ----
  if (vendors.length > 0) {
    sectionNumber += 1;
    const vendorPages = chunk(vendors, 8);
    vendorPages.forEach((pageVendors, pageIndex) => {
      const rows = pageVendors
        .map((v, i) => {
          const idea =
            v.contentIdea ??
            buildCreatorContentIdea({ categories: [v.reason ?? ""] }, facts, pageIndex * 8 + i);
          return `
        <tr>
          <td><div class="creator-name">${avatarHtml(v)}<span>${escapeHtml(v.displayName)}</span></div></td>
          <td>${tierChip(v.tier)}</td>
          <td>${escapeHtml(v.platform ?? "—")}</td>
          <td class="num">${formatCompact(v.followers)}</td>
          <td class="num">${v.engagementRate != null ? `${v.engagementRate.toFixed(1)}%` : "—"}</td>
          <td class="concept">${escapeHtml(idea)}</td>
        </tr>`;
        })
        .join("");
      const title =
        vendorPages.length > 1
          ? `Recommended Creators & Content Concepts (${pageIndex + 1}/${vendorPages.length})`
          : "Recommended Creators & Content Concepts";
      pages.push(`
  <div class="page">
    ${deckBrandHeader(sectionNumber, client)}
    ${deckEyebrow(deckIcon(ICONS.users), DECK.blue, "rgba(0,87,255,.1)", title)}
    <table class="ctable">
      <thead><tr><th>Creator</th><th>Tier</th><th>Platform</th><th>Followers</th><th>ER</th><th>Content concept</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${deckFooter(pages.length + 1, client)}
  </div>`);
    });
  }

  // ---- Budget & Amplification ----
  sectionNumber += 1;
  const allocations = model.budget?.allocations ?? [];
  const primaryAlloc = allocations[0];
  const totalText = model.budget?.total != null
    ? `${model.budget.currency} ${model.budget.total.toLocaleString()}`
    : "To be confirmed";
  const budgetHero = model.budget
    ? `<div class="budget-hero">
        <div><div class="big">${primaryAlloc?.percent ?? 100}%</div><div class="cap">${escapeHtml(primaryAlloc?.category ?? "Creator fees")} — ${escapeHtml(totalText)}</div></div>
        <div class="amt">${escapeHtml(primaryAlloc?.notes ?? "Influencer campaign model — production embedded in creator fees unless explicitly separated")}</div>
      </div>
      ${
        allocations.length > 1
          ? `<div class="alloc-list">${allocations
              .slice(1)
              .map(
                (a) =>
                  `<div class="alloc-row"><b>${a.percent ?? 0}%</b><span>${escapeHtml(a.category)}</span>${a.notes ? `<i>${escapeHtml(a.notes)}</i>` : ""}</div>`
              )
              .join("")}</div>`
          : ""
      }`
    : `<p class="sec-sub">Budget to be confirmed with client.</p>`;
  const ampItems = model.amplification
    .map(
      ([emoji, item]) =>
        `<div class="amp-item"><span class="ic">${ampIconSvg(emoji)}</span>${escapeHtml(item)}</div>`
    )
    .join("");
  pages.push(`
  <div class="page">
    ${deckBrandHeader(sectionNumber, client)}
    ${deckEyebrow(deckIcon(ICONS.coin), DECK.amber, "rgba(217,119,6,.12)", "Budget & Amplification")}
    ${budgetHero}
    <div class="amp-grid">${ampItems}</div>
    ${deckFooter(pages.length + 1, client)}
  </div>`);

  // ---- Success Metrics ----
  if (model.kpis.length > 0) {
    sectionNumber += 1;
    const kpiRows = model.kpis
      .slice(0, 6)
      .map(
        (k) =>
          `<tr><td style="font-weight:700;">${escapeHtml(k.metric)}</td><td>${escapeHtml(k.target)}</td><td>${escapeHtml(k.basis)}</td></tr>`
      )
      .join("");
    pages.push(`
  <div class="page">
    ${deckBrandHeader(sectionNumber, client)}
    ${deckEyebrow(deckIcon(ICONS.chart), DECK.green, "rgba(12,157,87,.1)", "Success Metrics")}
    <table class="mtable">
      <thead><tr><th>Metric</th><th>Target</th><th>Basis</th></tr></thead>
      <tbody>${kpiRows}</tbody>
    </table>
    ${deckFooter(pages.length + 1, client)}
  </div>`);
  }

  // ---- Close ----
  const closeHeadline = buildProposalCloseHeadline(model);
  pages.push(`
  <div class="page close">
    ${renderThinkwayReportLogoHtml({ variant: "closing", theme: "dark" })}
    <h2>${escapeHtml(closeHeadline)}</h2>
    <p>Prepared by the Thinkway Campaign Intelligence team · ${escapeHtml(generated)}</p>
    <div class="contact">${escapeHtml(CONTACT_LINE)}</div>
  </div>`);

  const { widthPx, heightPx, widthIn, heightIn } = SLIDE_DECK_PAGE;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(client)} — Campaign Intelligence Proposal</title>
<style>
  @page{ size: ${widthIn} ${heightIn}; margin: 0; }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html,body{
    margin:0; padding:0;
    width:${widthIn};
    min-width:${widthIn};
  }
  body{
    font-family:'Inter',-apple-system,'Segoe UI',system-ui,sans-serif;
    color:${DECK.ink};
    -webkit-font-smoothing:antialiased;
    background:#fff;
  }
  ${THINKWAY_REPORT_LOGO_STYLES}
  .num{ font-variant-numeric: tabular-nums; }

  .page{
    width:${widthIn}; height:${heightIn};
    position:relative;
    page-break-after: always;
    overflow:hidden;
    background:#fff;
  }
  /* Browser preview: scale fixed 1280×720 slides to fill viewport width (print/PDF unchanged). */
  @media screen{
    html,body{
      width:100%;
      min-width:0;
      overflow-x:hidden;
      background:#0b0f1a;
    }
    .page{
      width:${widthPx}px;
      height:${heightPx}px;
      transform-origin:top center;
      transform:scale(calc(100vw / ${widthPx}));
      margin-left:auto;
      margin-right:auto;
      margin-bottom:calc(${heightPx}px * (100vw / ${widthPx} - 1));
      page-break-after:auto;
    }
  }
  @media print{
    html,body{
      width:${widthIn};
      margin:0; padding:0;
    }
    .page{
      width:${widthIn};
      height:${heightIn};
      transform:none;
      margin:0;
      page-break-after:always;
    }
  }
  .page:last-child{ page-break-after: auto; }

  /* ---- shared chrome for content pages ---- */
  .pg-head{
    display:flex; align-items:center; justify-content:space-between;
    padding: 34px 56px 0;
  }
  .pg-head .brand{ display:flex; align-items:center; gap:10px; }
  .pg-head .tag{ font-size:11px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; color:${DECK.muted}; }
  .pg-foot{
    position:absolute; left:0; right:0; bottom:0;
    display:flex; align-items:center; justify-content:space-between;
    padding: 0 56px 26px; font-size:10.5px; color:#9AA3B2;
  }
  .pg-foot b{ color:${DECK.muted}; }

  /* ================= COVER ================= */
  .cover{
    background:
      radial-gradient(120% 100% at 100% 0%, rgba(124,58,237,0.55) 0%, rgba(124,58,237,0) 45%),
      radial-gradient(90% 90% at 0% 100%, rgba(0,87,255,0.55) 0%, rgba(0,87,255,0) 50%),
      linear-gradient(160deg, #05060c 0%, #0a0d18 55%, #060914 100%);
    color:#fff;
  }
  .cover::before{
    content:""; position:absolute; inset:0;
    background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 18px 18px;
  }
  .cover-inner{ position:relative; padding: 56px 64px; height:100%; display:flex; flex-direction:column; }
  .cover-top{ display:flex; justify-content:space-between; align-items:flex-start; }
  .cover-top-right{ display:flex; align-items:center; gap:14px; }
  .client-logo{ max-height:34px; max-width:120px; object-fit:contain; background:#fff; border-radius:8px; padding:4px 8px; }
  .cover-tag{
    font-size:11px; font-weight:800; letter-spacing:1.8px; text-transform:uppercase;
    background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16);
    padding:7px 14px; border-radius:999px; color:#C9D8FF;
  }
  .cover-client{ font-weight:900; letter-spacing:-4px; margin-top:auto; }
  .cover-obj{ font-size:19px; color:#B9C4E0; max-width:760px; margin-top:20px; line-height:1.55; }
  .cover-meta{ display:flex; gap:48px; margin-top:56px; }
  .cover-meta div{ font-size:12.5px; color:#8791AE; }
  .cover-meta b{ display:block; color:#fff; font-size:14px; font-weight:700; margin-top:4px; }

  /* ================= SECTION HEADER ================= */
  .sec-eyebrow{ display:flex; align-items:center; gap:10px; padding: 40px 56px 0; }
  .sec-eyebrow .ic{ width:34px;height:34px;border-radius:10px; display:flex;align-items:center;justify-content:center; }
  .sec-eyebrow h1{ font-size:28px; font-weight:800; letter-spacing:-0.8px; }
  .sec-sub{ padding: 8px 56px 0; font-size:13.5px; color:${DECK.muted}; max-width:820px; }

  /* ================= UNDERSTANDING ================= */
  .stat-grid{ display:flex; gap:16px; padding: 28px 56px 0; }
  .stat-box{
    flex:1;
    background: linear-gradient(160deg,#F5F8FF,#EEF2FC);
    background-color:#F5F8FF;
    border:1px solid rgba(11,15,26,0.08); border-radius:18px; padding:20px 22px;
    border-top: 4px solid ${DECK.blue};
  }
  .stat-box .l{ font-size:11px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; color:${DECK.muted}; }
  .stat-box .v{ font-size:30px; font-weight:800; letter-spacing:-0.8px; margin-top:6px; }
  .stat-box .s{ font-size:12px; color:${DECK.muted}; margin-top:3px; }

  .detail-grid{ display:flex; flex-wrap:wrap; padding: 30px 56px 0; gap: 0 40px; }
  .detail-item{ width: calc(50% - 20px); padding: 15px 0; border-bottom:1px solid rgba(11,15,26,0.08); }
  .detail-item .l{ font-size:10.5px; font-weight:800; letter-spacing:.5px; text-transform:uppercase; color:${DECK.muted}; margin-bottom:5px; }
  .detail-item .v{ font-size:15px; font-weight:600; line-height:1.5; }

  /* ================= SUMMARY ================= */
  .summary-text{ padding: 26px 56px 0; font-size:16px; line-height:1.75; color:#374151; max-width: 980px; }
  .check-grid{ display:flex; flex-wrap:wrap; gap: 14px 24px; padding: 26px 56px 0; }
  .check-item{
    width: calc(50% - 12px);
    display:flex; align-items:flex-start; gap:12px; font-size:14.5px; color:${DECK.ink};
    background:#FAFBFF; border:1px solid rgba(11,15,26,0.06); border-radius:14px; padding:16px 18px;
  }
  .check-item .ck{
    width:22px;height:22px;border-radius:7px; background:rgba(0,87,255,0.12); color:${DECK.blue};
    display:flex;align-items:center;justify-content:center; flex-shrink:0; margin-top:1px;
  }

  /* ================= STRATEGY / TIMELINE ================= */
  .strategy-row{ display:flex; gap:18px; padding: 26px 56px 0; }
  .strategy-tag{
    flex:1; text-align:center; padding: 28px 18px; border-radius:18px;
    background-color:#0B0F1A; background-image: linear-gradient(160deg,#0B0F1A,#171D31); color:#fff;
  }
  .strategy-tag .n{ font-size:24px; font-weight:800; }
  .strategy-tag .l{ font-size:12.5px; color:#9AA6C7; margin-top:6px; }

  .timeline{ position:relative; padding: 30px 56px 0 90px; }
  .timeline::before{ content:""; position:absolute; left:69px; top:36px; bottom:10px; width:2px; background-color:#7C3AED; background-image:linear-gradient(180deg,#7C3AED,#0057FF,#3D8BFF); }
  .t-item{ position:relative; padding-bottom: 20px; display:flex; align-items:flex-start; gap:16px; }
  .t-dot{
    position:absolute; left:-38px; top:0; width:32px; height:32px; border-radius:50%;
    display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px; font-weight:800;
    box-shadow: 0 0 0 5px #fff;
  }
  .t-item h4{ font-size:15px; font-weight:800; }
  .t-item p{ font-size:12.5px; color:${DECK.muted}; margin-top:2px; }

  /* ================= CREATOR TABLE ================= */
  .ctable{ width:calc(100% - 112px); margin:26px 56px 0; border-collapse:collapse; font-size:13px; }
  .ctable th{
    text-align:left; font-size:10.5px; font-weight:800; letter-spacing:.5px; text-transform:uppercase;
    color:${DECK.muted}; padding: 0 12px 12px; border-bottom:2px solid ${DECK.ink};
  }
  .ctable td{ padding: 12px 12px; border-bottom:1px solid rgba(11,15,26,0.08); vertical-align:middle; }
  .ctable td.concept{ font-size:12.5px; color:#374151; max-width:420px; }
  .creator-name{ display:flex; align-items:center; gap:10px; font-weight:700; }
  .avatar{
    width:28px;height:28px;border-radius:50%; overflow:hidden; flex-shrink:0;
    background-color:${DECK.blue}; background-image:linear-gradient(135deg,#0057FF,#7C3AED);
    display:inline-flex; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:800;
  }
  .avatar img{ width:100%; height:100%; object-fit:cover; }
  .tier-chip{ font-size:10.5px; font-weight:800; padding:4px 10px; border-radius:999px; display:inline-block; white-space:nowrap; }

  /* ================= BUDGET ================= */
  .budget-hero{
    margin: 30px 56px 0;
    background-color:${DECK.blue}; background-image: linear-gradient(135deg,#0040CC,#0057FF 55%,#7C3AED);
    border-radius:22px; padding: 40px 46px; color:#fff; display:flex; align-items:center; justify-content:space-between;
  }
  .budget-hero .big{ font-size:64px; font-weight:900; letter-spacing:-2px; }
  .budget-hero .cap{ font-size:14px; opacity:.85; margin-top:6px; }
  .budget-hero .amt{ text-align:right; font-family:ui-monospace,'Courier New',monospace; font-size:15px; font-weight:600; line-height:1.7; max-width:420px; }
  .alloc-list{ padding: 18px 56px 0; }
  .alloc-row{ display:flex; align-items:baseline; gap:12px; padding:9px 0; border-bottom:1px solid rgba(11,15,26,0.08); font-size:13.5px; }
  .alloc-row b{ color:${DECK.blue}; font-size:15px; min-width:48px; }
  .alloc-row i{ color:${DECK.muted}; font-style:normal; font-size:12px; }

  .amp-grid{ display:flex; flex-wrap:wrap; gap: 16px; padding: 30px 56px 0; }
  .amp-item{
    width: calc(50% - 8px); display:flex; gap:14px; font-size:14.5px; align-items:flex-start;
    background:#FAFBFF; border:1px solid rgba(11,15,26,0.06); border-radius:14px; padding:16px 18px;
  }
  .amp-item .ic{ width:26px;height:26px;border-radius:8px; background:rgba(0,87,255,0.12); color:${DECK.blue}; display:flex;align-items:center;justify-content:center; flex-shrink:0; }

  /* ================= METRICS + CLOSE ================= */
  .mtable{ width:calc(100% - 112px); margin: 30px 56px 0; border-collapse:collapse; font-size:15px; }
  .mtable th{ text-align:left; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:${DECK.muted}; padding:0 14px 14px; border-bottom:2px solid ${DECK.ink}; }
  .mtable td{ padding:18px 14px; border-bottom:1px solid rgba(11,15,26,0.08); }

  .close{
    background-color:#05060c; background-image:
      radial-gradient(90% 90% at 100% 100%, rgba(0,87,255,0.5) 0%, rgba(0,87,255,0) 50%),
      linear-gradient(160deg, #05060c 0%, #0a0d18 60%, #060914 100%);
    color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
  }
  .close h2{ font-size:38px; font-weight:800; letter-spacing:-1px; max-width:760px; line-height:1.3; }
  .close p{ font-size:14px; color:#98A3C4; margin-top:20px; }
  .close .contact{ margin-top: 46px; font-size:13px; color:#7885A8; }
</style>
</head>
<body>
${pages.join("\n")}
</body>
</html>`;
}

// Re-export for components that hydrate vendors client-side
export { resolveCreatorIds } from "../services/section-data-resolver";
