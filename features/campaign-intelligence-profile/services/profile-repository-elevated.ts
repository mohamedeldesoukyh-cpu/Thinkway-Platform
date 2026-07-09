import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  CampaignIntelligenceProfile,
  CampaignIntelligenceProfileRow,
} from "../types/profile";
import { PROFILE_SELECT } from "./profile-repository";
import { assertAccessibleBrandId } from "./assert-accessible-brand";

/**
 * Server-only writes for brief upload finalize.
 * User JWT is validated first; service role persists rows because PostgREST
 * RLS intermittently sees auth.uid() as null in server actions.
 */
export async function elevatedCreateCampaignIntelligenceProfile(
  userSupabase: SupabaseClient,
  input: {
    userId: string;
    conversationId?: string | null;
    brandId: string;
    campaignHeaderId?: string | null;
    title?: string;
    profile?: CampaignIntelligenceProfile;
    sourceDocumentId?: string | null;
  }
): Promise<CampaignIntelligenceProfileRow> {
  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser();

  if (authError || !user || user.id !== input.userId) {
    throw new Error("You must be signed in to save campaign intelligence.");
  }

  if (!input.brandId?.trim()) {
    throw new Error("Campaign Intelligence requires a brand.");
  }

  const brandAccess = await assertAccessibleBrandId(userSupabase, input.brandId);
  if (!brandAccess.ok) {
    throw new Error(brandAccess.message);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("campaign_intelligence_profiles")
    .insert({
      created_by: input.userId,
      conversation_id: input.conversationId ?? null,
      brand_id: input.brandId,
      campaign_header_id: input.campaignHeaderId ?? null,
      title: input.title ?? null,
      status: "draft",
      profile:
        input.profile ??
        ({
          schemaVersion: 1,
          status: "draft",
          extractedAt: new Date().toISOString(),
          confidence: {},
          sources: {},
        } satisfies CampaignIntelligenceProfile),
      source_document_id: input.sourceDocumentId ?? null,
    })
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CampaignIntelligenceProfileRow;
}

export async function elevatedUpdateCampaignIntelligenceProfile(
  userSupabase: SupabaseClient,
  profileId: string,
  input: {
    userId: string;
    profile: CampaignIntelligenceProfile;
    status?: "draft" | "saved" | "archived";
    title?: string | null;
    conversationId?: string | null;
    brandId?: string | null;
    campaignHeaderId?: string | null;
  }
): Promise<CampaignIntelligenceProfileRow> {
  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser();

  if (authError || !user || user.id !== input.userId) {
    throw new Error("You must be signed in to save campaign intelligence.");
  }

  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    profile: input.profile,
    updated_by: input.userId,
  };
  if (input.status) patch.status = input.status;
  if (input.title !== undefined) patch.title = input.title;
  if (input.conversationId !== undefined) patch.conversation_id = input.conversationId;
  if (input.brandId !== undefined) patch.brand_id = input.brandId;
  if (input.campaignHeaderId !== undefined) patch.campaign_header_id = input.campaignHeaderId;

  const { data, error } = await admin
    .from("campaign_intelligence_profiles")
    .update(patch)
    .eq("id", profileId)
    .eq("created_by", input.userId)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CampaignIntelligenceProfileRow;
}

export async function elevatedLinkDocumentToProfile(
  userSupabase: SupabaseClient,
  userId: string,
  documentId: string,
  profileId: string
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser();

  if (authError || !user || user.id !== userId) {
    throw new Error("You must be signed in to save campaign intelligence.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("campaign_intelligence_documents")
    .update({ profile_id: profileId })
    .eq("id", documentId)
    .eq("uploaded_by", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function elevatedSetProfileSourceDocument(
  userSupabase: SupabaseClient,
  userId: string,
  profileId: string,
  documentId: string
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await userSupabase.auth.getUser();

  if (authError || !user || user.id !== userId) {
    throw new Error("You must be signed in to save campaign intelligence.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("campaign_intelligence_profiles")
    .update({ source_document_id: documentId })
    .eq("id", profileId)
    .eq("created_by", userId);

  if (error) {
    throw new Error(error.message);
  }
}
