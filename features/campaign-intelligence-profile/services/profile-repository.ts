import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CampaignIntelligenceProfile,
  CampaignIntelligenceProfileRow,
} from "../types/profile";

const PROFILE_SELECT =
  "id, created_by, conversation_id, brand_id, campaign_header_id, status, profile, source_document_id, title, created_at, updated_at";

export { PROFILE_SELECT };

export async function getLatestCampaignIntelligenceProfileForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<CampaignIntelligenceProfileRow | null> {
  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select(PROFILE_SELECT)
    .eq("created_by", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return data as CampaignIntelligenceProfileRow;
}

export async function getLatestDocumentForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<{ file_name: string; file_size_bytes: number | null; parsed_text_length: number } | null> {
  const { data, error } = await supabase
    .from("campaign_intelligence_documents")
    .select("file_name, file_size_bytes, parsed_text")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { file_name: string; file_size_bytes: number | null; parsed_text: string | null };
  return {
    file_name: row.file_name,
    file_size_bytes: row.file_size_bytes,
    parsed_text_length: row.parsed_text?.length ?? 0,
  };
}

export async function listRecentCampaignIntelligenceProfiles(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<CampaignIntelligenceProfileRow[]> {
  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select(PROFILE_SELECT)
    .eq("created_by", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignIntelligenceProfileRow[];
}

export async function getCampaignIntelligenceProfileById(
  supabase: SupabaseClient,
  profileId: string
): Promise<CampaignIntelligenceProfileRow | null> {
  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return data as CampaignIntelligenceProfileRow;
}

export async function getCampaignIntelligenceProfileForConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<CampaignIntelligenceProfileRow | null> {
  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select(PROFILE_SELECT)
    .eq("conversation_id", conversationId)
    .in("status", ["draft", "saved"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return data as CampaignIntelligenceProfileRow;
}

/** Latest draft or saved CIP linked to a Studio conversation (workflow search path). */
export async function getWorkflowCampaignIntelligenceProfileForConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<CampaignIntelligenceProfileRow | null> {
  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select(PROFILE_SELECT)
    .eq("conversation_id", conversationId)
    .in("status", ["draft", "saved"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return data as CampaignIntelligenceProfileRow;
}

/** Latest saved library brief not yet linked to a Studio conversation. */
export async function findSavedCampaignIntelligenceProfileForWorkflow(
  supabase: SupabaseClient,
  userId: string,
  options?: { brandId?: string | null; brandName?: string | null }
): Promise<CampaignIntelligenceProfileRow | null> {
  let query = supabase
    .from("campaign_intelligence_profiles")
    .select(PROFILE_SELECT)
    .eq("status", "saved")
    .is("conversation_id", null)
    .order("updated_at", { ascending: false })
    .limit(options?.brandId ? 20 : 30);

  if (options?.brandId?.trim()) {
    query = query.eq("brand_id", options.brandId.trim());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CampaignIntelligenceProfileRow[];
  if (rows.length === 0) return null;

  const ownRows = rows.filter((row) => row.created_by === userId);
  const pool = ownRows.length > 0 ? ownRows : rows;

  const brandNameHint = options?.brandName?.trim().toLowerCase();
  if (brandNameHint) {
    const matched = pool.find((row) => {
      const profile = row.profile as { brandName?: string };
      const name = profile.brandName?.trim().toLowerCase();
      return name && (name.includes(brandNameHint) || brandNameHint.includes(name));
    });
    if (matched) return matched;
  }

  return pool[0] ?? null;
}

export async function listSavedCampaignIntelligenceProfiles(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<CampaignIntelligenceProfileRow[]> {
  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select(PROFILE_SELECT)
    .eq("created_by", userId)
    .eq("status", "saved")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignIntelligenceProfileRow[];
}

export async function createCampaignIntelligenceProfile(
  supabase: SupabaseClient,
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
  if (!input.brandId?.trim()) {
    throw new Error("Campaign Intelligence requires a brand.");
  }

  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .insert({
      created_by: input.userId,
      conversation_id: input.conversationId ?? null,
      brand_id: input.brandId,
      campaign_header_id: input.campaignHeaderId ?? null,
      title: input.title ?? null,
      status: "draft",
      profile: input.profile ?? { schemaVersion: 1, status: "draft", extractedAt: new Date().toISOString(), confidence: {}, sources: {} },
      source_document_id: input.sourceDocumentId ?? null,
    })
    .select(PROFILE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as CampaignIntelligenceProfileRow;
}

export async function updateCampaignIntelligenceProfile(
  supabase: SupabaseClient,
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
  const patch: Record<string, unknown> = {
    profile: input.profile,
    updated_by: input.userId,
  };
  if (input.status) patch.status = input.status;
  if (input.title !== undefined) patch.title = input.title;
  if (input.conversationId !== undefined) patch.conversation_id = input.conversationId;
  if (input.brandId !== undefined) patch.brand_id = input.brandId;
  if (input.campaignHeaderId !== undefined) patch.campaign_header_id = input.campaignHeaderId;

  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .update(patch)
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return data as CampaignIntelligenceProfileRow;
}

export async function linkDocumentToProfile(
  supabase: SupabaseClient,
  documentId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from("campaign_intelligence_documents")
    .update({ profile_id: profileId })
    .eq("id", documentId);

  if (error) throw new Error(error.message);
}

export async function insertCampaignIntelligenceDocument(
  supabase: SupabaseClient,
  input: {
    userId: string;
    profileId?: string | null;
    storagePath: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    parsedText?: string | null;
    llmBriefText?: string | null;
    structuredDocument?: Record<string, unknown> | null;
    parseStatus: "pending" | "parsing" | "parsed" | "failed";
    parseError?: string | null;
  }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("campaign_intelligence_documents")
    .insert({
      profile_id: input.profileId ?? null,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      parsed_text: input.parsedText ?? null,
      llm_brief_text: input.llmBriefText ?? null,
      structured_document: input.structuredDocument ?? null,
      parse_status: input.parseStatus,
      parse_error: input.parseError ?? null,
      uploaded_by: input.userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id as string };
}

export async function setProfileSourceDocument(
  supabase: SupabaseClient,
  profileId: string,
  documentId: string
): Promise<void> {
  const { error } = await (supabase as SupabaseClient)
    .from("campaign_intelligence_profiles")
    .update({ source_document_id: documentId })
    .eq("id", profileId);

  if (error) throw new Error(error.message);
}

export type CampaignIntelligenceDocumentRow = {
  id: string;
  profile_id: string | null;
  uploaded_by: string;
  parsed_text: string | null;
  llm_brief_text: string | null;
  structured_document: Record<string, unknown> | null;
  file_name: string;
  file_size_bytes: number | null;
};

export async function getCampaignIntelligenceDocument(
  supabase: SupabaseClient,
  documentId: string
): Promise<{
  id: string;
  parsed_text: string | null;
  llm_brief_text: string | null;
  structured_document: Record<string, unknown> | null;
  file_name: string;
} | null> {
  const row = await getCampaignIntelligenceDocumentRow(supabase, documentId);
  if (!row) return null;
  return {
    id: row.id,
    parsed_text: row.parsed_text,
    llm_brief_text: row.llm_brief_text,
    structured_document: row.structured_document,
    file_name: row.file_name,
  };
}

export async function getCampaignIntelligenceDocumentRow(
  supabase: SupabaseClient,
  documentId: string
): Promise<CampaignIntelligenceDocumentRow | null> {
  const { data, error } = await supabase
    .from("campaign_intelligence_documents")
    .select(
      "id, profile_id, uploaded_by, parsed_text, llm_brief_text, structured_document, file_name, file_size_bytes"
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CampaignIntelligenceDocumentRow | null;
}

export async function listDocumentsForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<Array<{ id: string; storage_path: string }>> {
  const { data, error } = await supabase
    .from("campaign_intelligence_documents")
    .select("id, storage_path")
    .eq("profile_id", profileId);

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; storage_path: string }>;
}

export async function deleteCampaignIntelligenceProfile(
  supabase: SupabaseClient,
  profileId: string,
  userId: string
): Promise<void> {
  const row = await getCampaignIntelligenceProfileById(supabase, profileId);
  if (!row || row.created_by !== userId) {
    throw new Error("Profile not found or access denied.");
  }

  const { error } = await supabase
    .from("campaign_intelligence_profiles")
    .delete()
    .eq("id", profileId)
    .eq("created_by", userId);

  if (error) throw new Error(error.message);
}
