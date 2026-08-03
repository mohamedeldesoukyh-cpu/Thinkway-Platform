import type { SupabaseClient } from "@supabase/supabase-js";

import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { hydrateSlateCreators } from "@/features/campaign-studio/services/copilot/slate-edit-mutations";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import {
  canGenerateFromCampaignPlan,
  parseCampaignPlanProvenance,
} from "@/lib/domains/commercial/campaign-plan-provenance";
import { resolveCampaignPlanBrandId } from "@/lib/domains/commercial/resolve-campaign-plan-brand";
import {
  attachScheduleHintsToLineSeeds,
  type ExecutionLineSeed,
} from "@/lib/domains/commercial/campaign-execution-schedule-inheritance";
import {
  mapCampaignPlanToLineSeeds,
  resolveCampaignNameFromPlan,
} from "@/lib/domains/commercial/campaign-plan-execution-mapper";
import {
  extractTentativeScheduleFromCampaignPlan,
  resolveCampaignPlanAnchorStartDate,
} from "@/lib/domains/commercial/campaign-plan-tentative-schedule";
import {
  mapQuotationItemsToExecutionLineSeeds,
  type QuotationItemExecutionRow,
} from "@/lib/domains/commercial/quotation-execution-mapper";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import { METADATA_PLATFORM_KEY } from "@/lib/campaigns/constants";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import type { Database } from "@/types/database";

import { isRelease20AssignmentConvertEnabled } from "@/lib/release/release-2-0-feature-flag";

import { applyInheritedTentativeScheduleToLine } from "./apply-inherited-tentative-schedule";
import { createCampaignLine } from "./campaign-line-service";
import { convertQuotationToAssignments } from "./convert-quotation-to-assignments";
import {
  fetchBrandForCampaignCreate,
  insertCampaignHeader,
  updateCampaignPoFields,
} from "./repositories/campaign-repository";

export type GenerateCampaignFromCampaignPlanInput = {
  campaignObjectId: string;
  brandId?: string | null;
  campaignName?: string | null;
  conversationId?: string | null;
};

export type GenerateCampaignFromCampaignPlanResult =
  | {
      ok: true;
      campaignId: string;
      documentNumber: string;
      linesCreated: number;
      alreadyExists: boolean;
      message: string;
      source: "quotation" | "campaign_plan";
    }
  | { ok: false; message: string };

async function resolveInfluencerIds(
  supabase: SupabaseClient<Database>,
  userId: string,
  creators: UnifiedCreatorResult[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const creator of creators) {
    const key = normalizeCreatorId(creator.unified_id);
    if (creator.influencer_id) {
      map.set(key, creator.influencer_id);
      continue;
    }

    if (creator.discovered_profile_id) {
      const promotion = await promoteDiscoveredProfileToInfluencer(
        supabase,
        creator.discovered_profile_id,
        userId
      );
      if (promotion.ok) {
        map.set(key, promotion.influencerId);
      }
    }
  }

  return map;
}

async function loadCreatorsByInfluencerIds(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<UnifiedCreatorResult[]> {
  const unique = [...new Set(influencerIds.filter(Boolean))];
  if (unique.length === 0) return [];

  const result = await browseUnifiedCreators(
    supabase,
    { influencerIds: unique, page: 1, pageSize: unique.length, productionOnly: true },
    "discovery"
  );
  return result.creators;
}

function addDaysIso(base: string, days: number): string {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolvePlanDates(campaignObject: import("@/features/campaign-intelligence").CampaignObject): {
  startDate: string | null;
  endDate: string | null;
} {
  const facts = getCampaignFacts(campaignObject);
  const durationWeeks = facts?.durationWeeks;
  const startDate = new Date().toISOString().slice(0, 10);
  const endDate =
    durationWeeks && durationWeeks > 0
      ? addDaysIso(startDate, durationWeeks * 7)
      : null;
  return { startDate, endDate };
}

function parseQuotationDeliverables(raw: unknown): QuotationDeliverable[] {
  if (!Array.isArray(raw)) return [];
  return raw as QuotationDeliverable[];
}

async function loadQuotationExecutionSource(
  supabase: SupabaseClient<Database>,
  campaignObjectId: string
): Promise<{
  quotationId: string;
  issueDate: string | null;
  currency: string;
  items: QuotationItemExecutionRow[];
} | null> {
  const { data: quotation } = await supabase
    .from("quotations")
    .select("id, issue_date, currency")
    .eq("campaign_object_id", campaignObjectId)
    .maybeSingle();

  if (!quotation) return null;

  const { data: items } = await supabase
    .from("quotation_items")
    .select(
      "id, influencer_id, unified_id, creator_name, platform, handle, deliverables, cost, revenue, cost_currency, option_number"
    )
    .eq("quotation_id", quotation.id)
    .order("sort_order");

  return {
    quotationId: quotation.id,
    issueDate: (quotation as { issue_date?: string | null }).issue_date ?? null,
    currency: (quotation as { currency?: string }).currency ?? "EGP",
    items: (items ?? []).map((row) => ({
      id: row.id,
      influencer_id: row.influencer_id,
      unified_id: row.unified_id,
      creator_name: row.creator_name,
      platform: row.platform,
      handle: row.handle,
      deliverables: parseQuotationDeliverables(row.deliverables),
      cost: Number(row.cost ?? 0),
      revenue: Number(row.revenue ?? 0),
      cost_currency: row.cost_currency ?? "EGP",
      option_number: row.option_number,
    })),
  };
}

async function resolveExecutionLineSeeds(input: {
  supabase: SupabaseClient<Database>;
  userId: string;
  campaignObject: import("@/features/campaign-intelligence").CampaignObject;
  quotationSource: Awaited<ReturnType<typeof loadQuotationExecutionSource>>;
}): Promise<{ seeds: ExecutionLineSeed[]; source: "quotation" | "campaign_plan" }> {
  const facts = getCampaignFacts(input.campaignObject);
  const defaultCurrency = facts?.budget?.currency ?? "EGP";

  if (input.quotationSource && input.quotationSource.items.length > 0) {
    const influencerIds = input.quotationSource.items
      .map((item) => item.influencer_id)
      .filter((id): id is string => Boolean(id));

    const creators = await loadCreatorsByInfluencerIds(input.supabase, influencerIds);
    const influencerIdByCreatorId = await resolveInfluencerIds(
      input.supabase,
      input.userId,
      creators
    );

    const seeds = mapQuotationItemsToExecutionLineSeeds({
      items: input.quotationSource.items,
      creators,
      influencerIdByCreatorId,
      defaultCurrency: input.quotationSource.currency || defaultCurrency,
    });

    return { seeds, source: "quotation" };
  }

  const hydratedCreators = await hydrateSlateCreators(input.supabase, input.campaignObject);
  const influencerIdByCreatorId = await resolveInfluencerIds(
    input.supabase,
    input.userId,
    hydratedCreators
  );

  const planSeeds = mapCampaignPlanToLineSeeds({
    campaignObject: input.campaignObject,
    creators: hydratedCreators,
    influencerIdByCreatorId,
  });

  const anchorStartDate = resolveCampaignPlanAnchorStartDate({
    campaignObject: input.campaignObject,
    issueDate: input.quotationSource?.issueDate ?? null,
  });

  const scheduleByCreatorKey = extractTentativeScheduleFromCampaignPlan(
    input.campaignObject,
    { anchorStartDate, issueDate: input.quotationSource?.issueDate ?? null }
  );

  return {
    seeds: attachScheduleHintsToLineSeeds({ seeds: planSeeds, scheduleByCreatorKey }),
    source: "campaign_plan",
  };
}

/**
 * Generates an operational campaign (header + lines + deliverables) from an
 * approved Campaign Plan snapshot. Uses quotation commercial snapshot when linked.
 */
export async function generateCampaignFromCampaignPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: GenerateCampaignFromCampaignPlanInput
): Promise<GenerateCampaignFromCampaignPlanResult> {
  const campaignObjectId = input.campaignObjectId.trim();
  if (!campaignObjectId) {
    return { ok: false, message: "Campaign Plan id is required." };
  }

  const { data: head, error: headError } = await supabase
    .from("campaign_objects")
    .select("id, lifecycle_status, current_version, campaign_header_id, conversation_id")
    .eq("id", campaignObjectId)
    .maybeSingle();

  if (headError) return { ok: false, message: headError.message };
  if (!head) return { ok: false, message: "Campaign Plan not found." };

  if (!canGenerateFromCampaignPlan(head.lifecycle_status)) {
    return {
      ok: false,
      message: "Only approved Campaign Plans can generate an execution campaign.",
    };
  }

  if (head.current_version <= 0) {
    return { ok: false, message: "Campaign Plan has no saved version to generate from." };
  }

  const { data: existingHeader } = await supabase
    .from("campaign_headers")
    .select("id, document_number")
    .eq("campaign_object_id", campaignObjectId)
    .maybeSingle();

  if (existingHeader) {
    return {
      ok: true,
      campaignId: existingHeader.id,
      documentNumber: existingHeader.document_number,
      linesCreated: 0,
      alreadyExists: true,
      source: "campaign_plan",
      message: `Execution campaign ${existingHeader.document_number} already exists for this Campaign Plan.`,
    };
  }

  const version = await CampaignObjectPersistenceService.loadVersion(
    supabase,
    campaignObjectId,
    head.current_version
  );
  if (!version?.campaignObject) {
    return { ok: false, message: "Failed to load the approved Campaign Plan version." };
  }

  const facts = getCampaignFacts(version.campaignObject);
  const brandId = await resolveCampaignPlanBrandId(supabase, {
    brandId: input.brandId,
    conversationId: input.conversationId ?? head.conversation_id,
    brandNameHint: facts?.brandName,
  });
  if (!brandId) {
    return {
      ok: false,
      message: "Select a brand before generating the execution campaign.",
    };
  }

  const { brand, error: brandError } = await fetchBrandForCampaignCreate(supabase, brandId);
  if (brandError || !brand) {
    return { ok: false, message: brandError ?? "Brand not found." };
  }

  const quotationSource = await loadQuotationExecutionSource(supabase, campaignObjectId);
  const campaignName =
    input.campaignName?.trim() || resolveCampaignNameFromPlan(version.campaignObject);
  const { startDate, endDate } = resolvePlanDates(version.campaignObject);
  const currencyCode = facts?.budget?.currency ?? brand.currency_code;
  const briefBudgetAmount = Math.round(facts?.budget?.amount ?? 0);
  const platform = facts?.platforms?.[0] ?? null;
  const metadata = platform ? { [METADATA_PLATFORM_KEY]: platform } : {};

  const provenance = parseCampaignPlanProvenance({
    campaign_object_id: campaignObjectId,
    source_campaign_object_version: head.current_version,
  });

  // Release 2.0: quotation-linked Path B uses the unified Assignment convert engine.
  if (quotationSource && isRelease20AssignmentConvertEnabled()) {
    const converted = await convertQuotationToAssignments(supabase, userId, {
      quotationId: quotationSource.quotationId,
      campaignName,
      dryRun: false,
    });

    if (!converted.ok) {
      return { ok: false, message: converted.message };
    }

    if (!converted.alreadyExists) {
      await supabase
        .from("campaign_headers")
        .update({
          campaign_object_id: provenance?.campaignObjectId ?? campaignObjectId,
          source_campaign_object_version:
            provenance?.sourceCampaignObjectVersion ?? head.current_version,
          start_date: startDate,
          end_date: endDate,
          metadata,
          name: campaignName,
        } as never)
        .eq("id", converted.campaignId);

      // Header PO must cover client revenue (what lines consume), not brief cost alone.
      const quotationPo = Math.round(
        quotationSource.items.reduce((sum, item) => sum + Math.max(0, Number(item.revenue ?? 0)), 0)
      );
      const poAmount = quotationPo > 0 ? quotationPo : briefBudgetAmount;
      if (poAmount > 0) {
        await updateCampaignPoFields(supabase, converted.campaignId, {
          currency: currencyCode,
          fxRate: 1,
          poAmount,
        });
      }
    }

    await supabase
      .from("campaign_objects")
      .update({
        campaign_header_id: converted.campaignId,
        updated_by: userId,
      })
      .eq("id", campaignObjectId);

    await logAuditEvent(supabase, {
      userId,
      action: "create",
      entityType: "campaign_header",
      entityId: converted.campaignId,
      metadata: {
        audit_action: "campaign_generated_from_plan",
        campaign_object_id: campaignObjectId,
        source_campaign_object_version: head.current_version,
        execution_source: "quotation",
        conversion_engine: "convertQuotationToAssignments",
        quotation_id: quotationSource.quotationId,
        lines_created: converted.linesCreated,
        already_exists: Boolean(converted.alreadyExists),
        snapshot_hash: converted.snapshotHash ?? null,
      },
      newData: {
        document_number: converted.documentNumber,
        campaign_object_id: campaignObjectId,
      },
    });

    return {
      ok: true,
      campaignId: converted.campaignId,
      documentNumber: converted.documentNumber,
      linesCreated: converted.linesCreated,
      alreadyExists: Boolean(converted.alreadyExists),
      source: "quotation",
      message: converted.alreadyExists
        ? converted.message
        : `Campaign ${converted.documentNumber} created with ${converted.linesCreated} Assignment(s) via unified quotation convert.`,
    };
  }

  const { seeds: lineSeeds, source } = await resolveExecutionLineSeeds({
    supabase,
    userId,
    campaignObject: version.campaignObject,
    quotationSource,
  });

  if (lineSeeds.length === 0) {
    return {
      ok: false,
      message: quotationSource
        ? "No quotation lines could be resolved to campaign execution lines."
        : "No approved slate creators could be resolved to campaign lines.",
    };
  }

  // STAB-021: PO ceiling must cover line revenue (client commercial), not brief cost.
  // With DEFAULT_GP_TARGET_PCT, revenue > brief budget-as-cost; consuming revenue against
  // a cost-sized PO immediately exceeds capacity and blocks Decision Center.
  const seededRevenuePo = Math.round(
    lineSeeds.reduce((sum, seed) => sum + Math.max(0, seed.revenue), 0)
  );
  const poAmount = seededRevenuePo > 0 ? seededRevenuePo : briefBudgetAmount;

  const { data: header, error: headerError } = await insertCampaignHeader(supabase, {
    name: campaignName,
    brand,
    status: "planning",
    currency_code: currencyCode,
    start_date: startDate,
    end_date: endDate,
    account_manager_id: null,
    metadata,
    created_by: userId,
    campaign_object_id: provenance?.campaignObjectId ?? campaignObjectId,
    source_campaign_object_version: provenance?.sourceCampaignObjectVersion ?? head.current_version,
  });

  if (headerError || !header) {
    return {
      ok: false,
      message: headerError?.message ?? "Failed to create execution campaign header.",
    };
  }

  if (poAmount > 0) {
    await updateCampaignPoFields(supabase, header.id, {
      currency: currencyCode,
      fxRate: 1,
      poAmount,
    });
  }

  let linesCreated = 0;
  let schedulesApplied = 0;
  const lineFailures: string[] = [];

  for (const seed of lineSeeds) {
    const result = await createCampaignLine(supabase, userId, {
      campaign_id: header.id,
      influencer_id: seed.influencerId,
      assignment_json: JSON.stringify({ platforms: seed.platforms }),
      pricing_mode: "package",
      name: seed.displayName,
      po_amount: seed.revenue,
      revenue: seed.revenue,
      cost: seed.cost,
      revenue_before_vat: seed.revenue,
      cost_before_vat: seed.cost,
      usage_rights_amount: 0,
      usage_rights_cost: 0,
      // GP margin is baked into revenue via mapCampaignPlanToLineSeeds (STAB-016).
      // Agency fee % is a separate commercial overlay — default 0 on Generate.
      agency_fee_percent: 0,
      revenue_vat_percent: 0,
      cost_vat_percent: 0,
      currency_code: seed.currencyCode,
      start_date: startDate,
      end_date: endDate,
      assignment_status: "assigned",
    });

    if (result.ok) {
      linesCreated += 1;

      if (seed.scheduleHints.length > 0) {
        const applied = await applyInheritedTentativeScheduleToLine(supabase, {
          campaignLineId: result.lineId,
          scheduleHints: seed.scheduleHints,
          fallbackLiveDate: endDate ?? startDate,
        });
        schedulesApplied += applied.updatedDeliverables;
      }
    } else {
      lineFailures.push(result.message);
    }
  }

  if (linesCreated === 0) {
    await supabase.from("campaign_headers").delete().eq("id", header.id);
    return {
      ok: false,
      message: lineFailures[0] ?? "Failed to create campaign lines from the Campaign Plan.",
    };
  }

  await supabase
    .from("campaign_objects")
    .update({
      campaign_header_id: header.id,
      updated_by: userId,
    })
    .eq("id", campaignObjectId);

  await logAuditEvent(supabase, {
    userId,
    action: "create",
    entityType: "campaign_header",
    entityId: header.id,
    metadata: {
      audit_action: "campaign_generated_from_plan",
      campaign_object_id: campaignObjectId,
      source_campaign_object_version: head.current_version,
      execution_source: source,
      quotation_id: quotationSource?.quotationId ?? null,
      lines_created: linesCreated,
      schedules_applied: schedulesApplied,
      line_failures: lineFailures.length,
    },
    newData: {
      document_number: header.document_number,
      campaign_object_id: campaignObjectId,
    },
  });

  const message =
    lineFailures.length > 0
      ? `Campaign ${header.document_number} created with ${linesCreated} line(s) from ${source === "quotation" ? "quotation snapshot" : "Campaign Plan"}. ${lineFailures.length} creator(s) could not be added.`
      : `Campaign ${header.document_number} created with ${linesCreated} vendor line(s) and tentative posting schedule inherited.`;

  return {
    ok: true,
    campaignId: header.id,
    documentNumber: header.document_number,
    linesCreated,
    alreadyExists: false,
    source,
    message,
  };
}
