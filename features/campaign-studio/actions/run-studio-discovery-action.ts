"use server";

import { serializeCampaignObject } from "@/features/campaign-intelligence";
import {
  loadCampaignObjectFromPersistence,
  saveCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";
import { getValidatedIntelligence } from "@/features/campaign-intelligence-profile/services/get-validated-intelligence";
import { normalizeCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/normalize-profile";
import { getWorkflowCampaignIntelligenceProfileForConversation } from "@/features/campaign-intelligence-profile/services/profile-repository";
import { searchCreatorsFromProfileData } from "@/features/campaign-intelligence-profile/services/search-creators-from-profile";
import { buildCreatorSearchRequirements } from "@/features/campaign-studio/services/creator-search-requirements/build-creator-search-requirements";
import { syncLatestStudioMessageCampaignObject } from "@/features/ai-workspace/services/conversation-campaign-hydration";
import { getConversationWithMessages } from "@/features/ai-workspace/services/conversation-service";

import { applyDiscoverySearchResultToCampaignObject } from "../services/apply-discovery-search-result";
import { campaignObjectFromLatestStudioMessage } from "../services/resolve-campaign-object-for-edit";
import { requireStudioUser } from "./persist-campaign-object-on-message";

/** Same page size the workflow's search-creators task uses. */
const STUDIO_DISCOVERY_PAGE_SIZE = 50;

export type RunStudioDiscoveryInput = {
  conversationId: string;
};

export type RunStudioDiscoveryResult =
  | {
      ok: true;
      message: string;
      creatorCount: number;
      total: number;
      campaignObject: Record<string, unknown>;
    }
  | { ok: false; message: string };

/**
 * Run Discovery for the Studio Creator stage.
 *
 * The Creator stage used to tell the operator to "Run Discovery against the
 * confirmed profile" with nothing to click: Discovery only ever ran as the
 * `search-creators` task inside the create-campaign workflow, so a campaign
 * whose workflow never produced creators was stuck reporting an accurate but
 * unactionable "Inventory has not been searched yet".
 *
 * This is that missing action, not a second Discovery. It calls
 * `searchCreatorsFromProfileData` — the identical function
 * `executeSearchCreatorsProduction` calls, with the same CIP filters, the same
 * Creator Search Requirements, the same coverage backfill, ranking and
 * constraint engine — and writes the result through the same section assembly
 * the workflow route uses.
 */
export async function runStudioDiscoveryAction(
  input: RunStudioDiscoveryInput
): Promise<RunStudioDiscoveryResult> {
  const conversationId = input.conversationId?.trim();
  if (!conversationId) {
    return { ok: false, message: "Missing conversation." };
  }

  try {
    const { supabase, userId } = await requireStudioUser();

    const conversation = await getConversationWithMessages(supabase, conversationId, userId);
    if (!conversation) {
      return { ok: false, message: "Could not find the campaign workspace." };
    }
    const contextSnapshot = (conversation.contextSnapshot ?? {}) as Record<string, unknown>;
    const campaignObject =
      (await loadCampaignObjectFromPersistence(supabase, conversationId, contextSnapshot)) ??
      campaignObjectFromLatestStudioMessage(conversation.messages);
    if (!campaignObject) {
      return { ok: false, message: "Could not find the campaign workspace to update." };
    }

    const row = await getWorkflowCampaignIntelligenceProfileForConversation(
      supabase,
      conversationId
    );
    if (!row) {
      return {
        ok: false,
        message: "No campaign intelligence profile is linked to this campaign yet.",
      };
    }

    const profile = normalizeCampaignIntelligenceProfile(row.profile);
    const validated = getValidatedIntelligence(profile);
    if (!validated) {
      return {
        ok: false,
        message:
          "Campaign intelligence is not validated yet — confirm the campaign facts on Intake, then run Discovery.",
      };
    }

    const facts = getCampaignFacts(campaignObject);
    const strategy = getStrategyFromWorkflowData(
      campaignObject.meta as unknown as Record<string, unknown>
    );

    // Phase 2 CSR, resolved from the same inputs the workflow resolves it from.
    const requirements = buildCreatorSearchRequirements({
      facts,
      strategy,
      validated,
      campaignIntelligenceProfileId: row.id,
    });

    const result = await searchCreatorsFromProfileData(
      supabase,
      profile,
      row.id,
      STUDIO_DISCOVERY_PAGE_SIZE,
      requirements
    );

    const applied = applyDiscoverySearchResultToCampaignObject({
      campaignObject,
      creators: result.creators,
      total: result.total,
      facts,
      strategy,
      validated,
      constraintReport: result.constraintReport,
      cipProfileId: row.id,
    });

    const saved = await saveCampaignObject(conversationId, applied.campaignObject, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });
    await syncLatestStudioMessageCampaignObject(supabase, conversationId, userId, saved);

    return {
      ok: true,
      creatorCount: result.creators.length,
      total: result.total,
      message:
        result.creators.length > 0
          ? `Discovery returned ${result.creators.length} creator${
              result.creators.length === 1 ? "" : "s"
            } for the confirmed profile.`
          : "Discovery ran and found no creators matching the confirmed profile.",
      campaignObject: serializeCampaignObject(saved) as unknown as Record<string, unknown>,
    };
  } catch (error) {
    // A failed search must never read as "searched, zero results" — nothing is
    // persisted on this path, so the stage keeps its previous state and the
    // operator is told the search itself failed.
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Discovery search failed.",
    };
  }
}
