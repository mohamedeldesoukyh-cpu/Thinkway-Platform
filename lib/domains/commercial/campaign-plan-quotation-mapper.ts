import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  getCampaignFacts,
  resolveFactsCurrency,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { resolveExecutiveStrategy } from "@/features/campaign-studio/services/section-data-resolver";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";
import type {
  CreatorsSectionData,
  CreativeConcept,
  OperationsSectionExtras,
  StrategySectionData,
  TimelineSectionExtras,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { LinePlatformSelection } from "@/lib/campaigns/line-assignment";
import { buildQuotationSeedFromCreator } from "@/lib/commercial-sync/shortlist-seeds";
import { DEFAULT_GP_TARGET_PCT } from "@/lib/domains/commercial/quotation-constants";
import { syncDeliverableFromTypeLines } from "@/lib/quotations/quotation-deliverable-types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  buildBudgetSectionDataFromFacts,
  getCampaignFacts as readFacts,
} from "@/features/campaign-director/facts/facts-display-bridge";
import {
  buildPlatformSelectionsForCreator,
  filterExecutionCreatorIds,
  resolveCampaignNameFromPlan,
} from "./campaign-plan-execution-mapper";
import { extractTentativeScheduleFromCampaignPlan } from "./campaign-plan-tentative-schedule";
import type { QuotationDeliverable, QuotationItemSeed } from "./quotation-types";
import { applyTentativeScheduleToQuotationItems } from "./quotation-tentative-schedule";

export type CampaignPlanQuotationHeaderSeed = {
  name: string;
  campaignName: string;
  notes: string | null;
};

export type MapCampaignPlanQuotationInput = {
  campaignObject: CampaignObject;
  creators: UnifiedCreatorResult[];
  influencerIdByCreatorId: Map<string, string>;
  contextText?: string;
  issueDate?: string | null;
  anchorStartDate?: string | null;
};

const CREATOR_FEES_CATEGORY = /creator\s*fees?/i;

function resolveCreatorFeesTotal(
  campaignObject: CampaignObject,
  contextText: string
): number {
  const facts = readFacts(campaignObject);
  if (!facts?.budget?.amount) return 0;

  const budgetData = buildBudgetSectionDataFromFacts(facts, contextText);
  const creatorLine = budgetData.allocations.find((line) =>
    CREATOR_FEES_CATEGORY.test(line.category)
  );
  if (creatorLine?.amount != null && creatorLine.amount > 0) {
    return Math.round(creatorLine.amount);
  }

  return Math.round(facts.budget.amount);
}

function readCreatorsData(campaignObject: CampaignObject): CreatorsSectionData {
  return (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
}

function readStrategyData(campaignObject: CampaignObject): StrategySectionData | null {
  const data = campaignObject.sections.strategy.data;
  return data && typeof data === "object" ? (data as StrategySectionData) : null;
}

function readTimelineExtras(campaignObject: CampaignObject): TimelineSectionExtras | null {
  const data = campaignObject.sections.timeline.data;
  return data && typeof data === "object" ? (data as TimelineSectionExtras) : null;
}

function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  if (total <= 0) return Array.from({ length: count }, () => 0);

  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

function resolveCreatorReasoning(
  campaignObject: CampaignObject,
  creatorId: string
): VendorSelectedReasoning | undefined {
  const reasoning = readCreatorsData(campaignObject).recommendations?.selectedReasoning ?? [];
  const key = normalizeCreatorId(creatorId);
  return reasoning.find((entry) => normalizeCreatorId(entry.creatorId) === key);
}

function parseDeliverableQuantity(
  factsDeliverables: string[] | undefined,
  platform: string,
  typeCode: string
): number {
  if (!factsDeliverables?.length) return 1;

  const platformKey = canonicalPlatformKey(platform);
  const typeTokens = typeCode.split("_").filter((token) => token.length > 2);

  for (const line of factsDeliverables) {
    const lower = line.toLowerCase();
    const platformHit =
      lower.includes(platformKey) ||
      (platformKey === "instagram" && /\big\b/.test(lower)) ||
      (platformKey === "tiktok" && /\btt\b|\btiktok\b/.test(lower));
    if (!platformHit) continue;

    const typeHit = typeTokens.some((token) => lower.includes(token.replace(/s$/, "")));
    if (!typeHit && typeTokens.length > 0) continue;

    const qtyMatch = line.match(/(\d+)\s*[×x]/i);
    if (qtyMatch) return Math.max(1, Number.parseInt(qtyMatch[1]!, 10));
    return 1;
  }

  return 1;
}

function buildDeliverablesForCreator(
  platforms: LinePlatformSelection[],
  factsDeliverables: string[] | undefined,
  currencyCode: string
): QuotationDeliverable[] {
  if (platforms.length === 0) return [];

  return platforms.map((selection) => {
    const typeLines = selection.deliverables.map((typeCode) => ({
      type: typeCode,
      quantity: parseDeliverableQuantity(factsDeliverables, selection.platform, typeCode),
    }));
    const synced = syncDeliverableFromTypeLines(
      typeLines,
      [selection.platform],
      selection.platform
    );

    return {
      platform: synced.platform,
      type: synced.type,
      types: synced.types,
      type_lines: synced.type_lines,
      quantity: 1,
      cost_currency: currencyCode,
      commercial_input_mode: "cost_gp_pct",
      gp_pct: DEFAULT_GP_TARGET_PCT,
    };
  });
}

function formatBulletSection(title: string, lines: string[]): string | null {
  const items = lines.map((line) => line.trim()).filter(Boolean);
  if (!items.length) return null;
  return `${title}:\n${items.map((line) => `- ${line}`).join("\n")}`;
}

function resolveContentPillars(campaignObject: CampaignObject): string[] {
  const strategy = readStrategyData(campaignObject);
  const concepts = (strategy?.creativeConcepts ?? []) as CreativeConcept[];
  const fromConcepts = concepts
    .map((concept) => concept.contentTheme?.trim())
    .filter((value): value is string => Boolean(value));

  const contentPlan = readTimelineExtras(campaignObject)?.contentPlan ?? [];
  const fromPlan = contentPlan.map((item) => {
    const parts = [item.platform, item.contentType, item.objective].filter(Boolean);
    return parts.join(" · ");
  });

  return [...new Set([...fromConcepts, ...fromPlan])];
}

function resolveSpecialRequirements(campaignObject: CampaignObject): string[] {
  const facts = getCampaignFacts(campaignObject);
  const requirements: string[] = [];

  if (facts?.deliverables?.length) {
    requirements.push(...facts.deliverables);
  }

  const operations = campaignObject.sections.operations;
  const enrichedRisks =
    (operations.data as OperationsSectionExtras | null)?.enrichedRisks ?? [];
  const risks = enrichedRisks.map(
    (risk) => `${risk.risk} (${risk.severity}) — ${risk.mitigation}`
  );

  if (risks.length) requirements.push(...risks);

  const timeline = readTimelineExtras(campaignObject);
  for (const week of timeline?.weekDetails ?? []) {
    requirements.push(...week.approvalGates, ...week.deliverables);
  }

  return [...new Set(requirements.map((line) => line.trim()).filter(Boolean))];
}

function resolveInternalNotes(campaignObject: CampaignObject): string[] {
  const reasoning = readCreatorsData(campaignObject).recommendations?.selectedReasoning ?? [];
  const directorNotes = reasoning
    .map((entry) => entry.directorNotes?.trim())
    .filter((value): value is string => Boolean(value));

  const operationsContent = campaignObject.sections.operations.content;
  const operationsText =
    typeof operationsContent === "string" ? operationsContent.trim() : "";

  return [
    ...directorNotes,
    ...(operationsText ? [operationsText] : []),
  ];
}

function buildCreatorServiceDescription(
  campaignObject: CampaignObject,
  creatorId: string
): string | null {
  const reasoning = resolveCreatorReasoning(campaignObject, creatorId);
  if (!reasoning) return null;

  const parts = [
    reasoning.expectedRole?.trim() ? `Role: ${reasoning.expectedRole.trim()}` : null,
    reasoning.contribution?.trim() ? `Contribution: ${reasoning.contribution.trim()}` : null,
    reasoning.risk?.trim() ? `Risk: ${reasoning.risk.trim()}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length ? parts.join(" · ") : null;
}

/** Map approved Campaign Plan strategy and operations context into quotation header notes. */
// @tech-debt: quotation.notes overloads key messages, pillars, and ops context — migrate to
// structured quotation fields when Phase 6+ commercial schema lands.
export function mapCampaignPlanToQuotationHeaderSeed(
  campaignObject: CampaignObject,
  contextText?: string
): CampaignPlanQuotationHeaderSeed {
  const campaignName = resolveCampaignNameFromPlan(campaignObject);
  const strategy = resolveExecutiveStrategy(campaignObject);
  const facts = getCampaignFacts(campaignObject);
  const excerpt = contextText?.trim() || facts?.rawBriefExcerpt?.trim() || "";

  const sections = [
    strategy?.keyMessage?.trim()
      ? `Key message: ${strategy.keyMessage.trim()}`
      : null,
    strategy?.objective?.trim() ? `Objective: ${strategy.objective.trim()}` : null,
    formatBulletSection("Content pillars", resolveContentPillars(campaignObject)),
    strategy?.creatorStrategy?.trim()
      ? `Creator strategy: ${strategy.creatorStrategy.trim()}`
      : null,
    strategy?.platformStrategy?.trim()
      ? `Platform strategy: ${strategy.platformStrategy.trim()}`
      : null,
    formatBulletSection("Service scope", facts?.platforms ?? []),
    formatBulletSection("Special requirements", resolveSpecialRequirements(campaignObject)),
    formatBulletSection("Internal notes", resolveInternalNotes(campaignObject)),
    excerpt ? `Brief excerpt:\n${excerpt}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    name: `Quotation — ${campaignName}`,
    campaignName,
    notes: sections.length ? sections.join("\n\n") : null,
  };
}

/**
 * Map an approved Campaign Plan snapshot into quotation item seeds with deliverables,
 * commercials, creator roles, and tentative schedule applied during mapping.
 */
export function mapCampaignPlanToQuotationItemSeeds(
  input: MapCampaignPlanQuotationInput
): QuotationItemSeed[] {
  const facts = getCampaignFacts(input.campaignObject);
  const contextText =
    input.contextText?.trim() || facts?.rawBriefExcerpt?.trim() || "";
  const currencyCode = facts ? resolveFactsCurrency(facts) : "EGP";
  const approvedIds = new Set(
    filterExecutionCreatorIds(input.campaignObject).map(normalizeCreatorId)
  );

  const eligibleCreators = input.creators.filter((creator) =>
    approvedIds.has(normalizeCreatorId(creator.unified_id))
  );

  const creatorFeesTotal = resolveCreatorFeesTotal(input.campaignObject, contextText);
  const perCreatorAmounts = splitEvenly(creatorFeesTotal, eligibleCreators.length);

  const baseSeeds = eligibleCreators.flatMap((creator, index) => {
    const influencerId = input.influencerIdByCreatorId.get(
      normalizeCreatorId(creator.unified_id)
    );
    if (!influencerId && !creator.discovered_profile_id) return [];

    const platforms = buildPlatformSelectionsForCreator(
      creator,
      facts?.platforms,
      facts?.deliverables
    );
    if (platforms.length === 0) return [];

    const amount = perCreatorAmounts[index] ?? 0;
    const deliverables = buildDeliverablesForCreator(
      platforms,
      facts?.deliverables,
      currencyCode
    );

    const base = buildQuotationSeedFromCreator(creator, {
      influencer_id: influencerId ?? creator.influencer_id ?? null,
      profile_id: creator.discovered_profile_id ?? null,
      unified_id: creator.unified_id,
      deliverables,
      service_description: buildCreatorServiceDescription(
        input.campaignObject,
        creator.unified_id
      ),
      commercial_input_mode: "cost_gp_pct",
      cost: amount > 0 ? amount : null,
      cost_currency: currencyCode,
      gp_pct: DEFAULT_GP_TARGET_PCT,
    });

    return [base];
  });

  const scheduleByCreatorKey = extractTentativeScheduleFromCampaignPlan(
    input.campaignObject,
    {
      anchorStartDate: input.anchorStartDate,
      issueDate: input.issueDate,
    }
  );

  if (scheduleByCreatorKey.size === 0) {
    return baseSeeds;
  }

  const { items } = applyTentativeScheduleToQuotationItems(
    baseSeeds,
    scheduleByCreatorKey
  );
  return items;
}
