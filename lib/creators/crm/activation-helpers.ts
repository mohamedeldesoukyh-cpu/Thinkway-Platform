/**
 * Shared CRM activation helpers.
 *
 * Phase 2B: assignment + quote→campaign dual-event (writers gated).
 * Do not call from Discovery import / Apify / shortlist-add / draft quotes / VIO / Convert.
 *
 * Dual-event strategy (quote → campaign):
 * - Persist audit reason `quotation_operational` when quotation becomes operational.
 * - Also record `campaign_assignment` for the assignment row.
 * - Profile creation still happens only via `ensureCommercialCreator` (once).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCommercialCreator } from "@/lib/creators/crm/ensure-commercial-creator";
import type {
  EnsureCommercialCreatorOutcome,
  EnsureCommercialCreatorResult,
} from "@/lib/creators/crm/types";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type CrmActivationActor = {
  actorId: string | null;
  roleSlug?: string | null;
  bypassRoleCheck?: boolean;
  metadata?: Record<string, unknown>;
};

export async function ensureCommercialCreatorFromAssignment(
  supabase: Supabase,
  input: CrmActivationActor & {
    influencerId: string;
    campaignInfluencerId: string;
  }
): Promise<EnsureCommercialCreatorOutcome> {
  return ensureCommercialCreator(supabase, {
    influencerId: input.influencerId,
    reason: "campaign_assignment",
    actorId: input.actorId,
    roleSlug: input.roleSlug,
    bypassRoleCheck: input.bypassRoleCheck ?? true,
    sourceEntityType: "campaign_influencer",
    sourceEntityId: input.campaignInfluencerId,
    metadata: input.metadata,
  });
}

export async function ensureCommercialCreatorFromOperationalQuotation(
  supabase: Supabase,
  input: CrmActivationActor & {
    influencerId: string;
    quotationId: string;
  }
): Promise<EnsureCommercialCreatorOutcome> {
  return ensureCommercialCreator(supabase, {
    influencerId: input.influencerId,
    reason: "quotation_operational",
    actorId: input.actorId,
    roleSlug: input.roleSlug,
    bypassRoleCheck: input.bypassRoleCheck ?? true,
    sourceEntityType: "quotation",
    sourceEntityId: input.quotationId,
    metadata: input.metadata,
  });
}

export async function ensureCommercialCreatorFromVendorIo(
  supabase: Supabase,
  input: CrmActivationActor & {
    influencerId: string;
    vendorIoId: string;
  }
): Promise<EnsureCommercialCreatorOutcome> {
  return ensureCommercialCreator(supabase, {
    influencerId: input.influencerId,
    reason: "vendor_io",
    actorId: input.actorId,
    roleSlug: input.roleSlug,
    bypassRoleCheck: input.bypassRoleCheck ?? true,
    sourceEntityType: "vendor_io",
    sourceEntityId: input.vendorIoId,
    metadata: input.metadata,
  });
}

/**
 * Dual-event path for quotation → campaign operationalise.
 * Activates (or refreshes) CRM once, then records both audit reasons when sources differ.
 */
export async function ensureCommercialCreatorFromQuoteToCampaign(
  supabase: Supabase,
  input: CrmActivationActor & {
    influencerId: string;
    quotationId: string;
    campaignInfluencerId: string;
  }
): Promise<{
  profile: EnsureCommercialCreatorOutcome;
  quotationEventId: string | null;
  assignmentEventId: string | null;
}> {
  const quotation = await ensureCommercialCreatorFromOperationalQuotation(supabase, {
    influencerId: input.influencerId,
    quotationId: input.quotationId,
    actorId: input.actorId,
    roleSlug: input.roleSlug,
    bypassRoleCheck: input.bypassRoleCheck,
    metadata: {
      ...input.metadata,
      dualEvent: "quotation_operational",
    },
  });

  const assignment = await ensureCommercialCreatorFromAssignment(supabase, {
    influencerId: input.influencerId,
    campaignInfluencerId: input.campaignInfluencerId,
    actorId: input.actorId,
    roleSlug: input.roleSlug,
    bypassRoleCheck: input.bypassRoleCheck,
    metadata: {
      ...input.metadata,
      dualEvent: "campaign_assignment",
      quotationId: input.quotationId,
    },
  });

  return {
    profile: assignment.ok ? assignment : quotation,
    quotationEventId: quotation.ok
      ? (quotation as EnsureCommercialCreatorResult).eventId
      : null,
    assignmentEventId: assignment.ok
      ? (assignment as EnsureCommercialCreatorResult).eventId
      : null,
  };
}
