import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { hydrateSlateCreators } from "@/features/campaign-studio/services/copilot/slate-edit-mutations";
import {
  canCreateClientReview,
  resolveStudioPackageReadiness,
} from "@/features/campaign-studio/services/studio-package-readiness";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientCreatorSelectionState } from "./constants";
import {
  mapClientReviewRow,
  persistClientReview,
  type CreateClientReviewResult,
} from "./persist-client-review";
import { packageFingerprintFromObject } from "./project-client-view";
import { snapshotFromCampaignObject } from "./snapshot-from-object";
import { loadIdentityLogoForReview } from "./identity-logo";

export type { CreateClientReviewResult };
export { mapClientReviewRow };

export type CreateClientReviewInput = {
  campaignObject: CampaignObject;
  conversationId: string;
  userId: string;
  roleSlug?: string | null;
  origin: string;
};

function initialSelection(campaignObject: CampaignObject): Record<string, ClientCreatorSelectionState> {
  const data = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const ids = data.recommendations?.creatorIds ?? [];
  const decisions = data.vendorDecisions ?? {};
  const selection: Record<string, ClientCreatorSelectionState> = {};
  for (const id of ids) {
    const decision = decisions[id];
    if (decision === "approved") selection[id] = "accepted";
    else if (decision === "rejected") selection[id] = "rejected";
    else selection[id] = "in_review";
  }
  return selection;
}

function linkedShortlistId(campaignObject: CampaignObject): string | null {
  const data = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  return data.linkedShortlistId ?? data.appliedShortlistIds?.at(-1) ?? null;
}

export async function createClientReview(
  supabase: SupabaseClient,
  input: CreateClientReviewInput
): Promise<CreateClientReviewResult> {
  const readiness = resolveStudioPackageReadiness(input.campaignObject);
  if (!canCreateClientReview(readiness)) {
    return {
      ok: false,
      message: "Cannot create client review.",
      blockers: readiness.clientReviewBlockers,
    };
  }

  const saved = await saveCampaignObject(input.conversationId, input.campaignObject, {
    supabase: supabase as never,
    userId: input.userId,
    persistToDb: true,
    saveReason: "review_submitted",
  });

  const latest = await CampaignObjectPersistenceService.loadLatestByConversation(
    supabase as never,
    input.conversationId
  );
  if (!latest) {
    return {
      ok: false,
      message: "Campaign package could not be frozen as a version.",
      blockers: ["Persist the Studio package before creating a client review."],
    };
  }

  const facts = getCampaignFacts(saved);
  const fingerprint = {
    source: "studio" as const,
    ...packageFingerprintFromObject(saved),
  };
  const selection = initialSelection(saved);
  let hydrated: Awaited<ReturnType<typeof hydrateSlateCreators>> = [];
  try {
    hydrated = await hydrateSlateCreators(supabase as never, saved);
  } catch {
    hydrated = [];
  }
  const snapshot = snapshotFromCampaignObject(saved, selection, hydrated);
  snapshot.identityLogo =
    (await loadIdentityLogoForReview(supabase, {
      campaignHeaderId: latest.record.campaignHeaderId,
      shortlistId: linkedShortlistId(saved),
      clientLabel: facts?.clientName ?? facts?.brandName ?? null,
    })) ?? undefined;

  const result = await persistClientReview({
    supabase,
    userId: input.userId,
    origin: input.origin,
    source: "studio",
    scope: { source: "studio", campaignObjectId: latest.record.id },
    campaignObjectId: latest.record.id,
    frozenVersion: latest.record.currentVersion,
    conversationId: input.conversationId,
    campaignHeaderId: latest.record.campaignHeaderId,
    shortlistId: linkedShortlistId(saved),
    clientLabel: facts?.clientName ?? facts?.brandName ?? null,
    brandName: facts?.brandName ?? null,
    campaignName: facts?.product ?? facts?.objective ?? null,
    fingerprint,
    selection,
    snapshot,
    alreadyOpenMessage: "A client review already exists for this package version.",
  });

  if (!result.ok) return result;

  try {
    await CampaignObjectPersistenceService.transitionLifecycle(supabase as never, {
      campaignObjectId: latest.record.id,
      toStatus: "in_review",
      userId: input.userId,
      roleSlug: input.roleSlug ?? null,
    });
  } catch {
    // Package freeze already succeeded; lifecycle is best-effort.
  }

  return result;
}
