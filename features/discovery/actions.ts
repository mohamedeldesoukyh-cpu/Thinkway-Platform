"use server";

import { revalidatePath } from "next/cache";

import { matchCampaignBrief } from "@/lib/discovery/campaign-match";
import { matchCreatorsForCampaign } from "@/lib/creators/campaign-match";
import { enqueueDiscoveryJob, enqueueEnrichmentJob } from "@/lib/discovery/queue";
import type { CampaignMatchRequest, DiscoveryJobPayload } from "@/lib/discovery/types";
import { createSupabaseServerClient, requireRequestUser } from "@/lib/supabase/server";

export async function startDiscoveryJobAction(payload: DiscoveryJobPayload) {
  const { supabase, userId } = await requireRequestUser();

  const { data: job, error } = await supabase
    .from("discovery_jobs")
    .insert({
      job_type: `discovery:${payload.method}`,
      method: payload.method,
      status: "pending",
      payload,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const queued = await enqueueDiscoveryJob(payload, job.id as string);
  revalidatePath("/discovery");
  return { jobId: job.id as string, queued };
}

export async function enrichDiscoveredProfileAction(profileId: string) {
  const { supabase, userId } = await requireRequestUser();

  const { data: job, error } = await supabase
    .from("discovery_jobs")
    .insert({
      job_type: "enrichment:profile",
      status: "pending",
      payload: { profileId },
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const queued = await enqueueEnrichmentJob({ profileId }, job.id as string);
  revalidatePath("/discovery");
  return { jobId: job.id as string, queued };
}

export type ShortlistVisibility = "private" | "shared";

export type CreateShortlistInput = {
  name: string;
  description?: string | null;
  campaignHeaderId?: string | null;
  visibility?: ShortlistVisibility;
};

export async function createShortlistAction(input: CreateShortlistInput) {
  const { supabase, userId } = await requireRequestUser();

  const name = input.name?.trim();
  if (!name) throw new Error("List name is required");

  const visibility: ShortlistVisibility = input.visibility ?? "private";

  const { data, error } = await supabase
    .from("discovery_shortlists")
    .insert({
      name,
      description: input.description?.trim() || null,
      owner_id: userId,
      campaign_header_id: input.campaignHeaderId || null,
      metadata: { visibility },
    })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/discovery");
  return data;
}

export async function addToShortlistAction(shortlistId: string, profileId: string, notes?: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("discovery_shortlist_items").insert({
    shortlist_id: shortlistId,
    profile_id: profileId,
    notes: notes ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/discovery");
  return { ok: true };
}

export async function matchCampaignBriefAction(request: CampaignMatchRequest) {
  const { supabase } = await requireRequestUser();

  const matches = await matchCampaignBrief(supabase, request);
  revalidatePath("/discovery");
  return matches;
}

export async function matchDiscoveryCreatorsBriefAction(input: {
  brief: string;
  platform?: string;
  country?: string;
  limit?: number;
}) {
  const { supabase, userId } = await requireRequestUser();
  return matchCreatorsForCampaign(supabase, {
    ...input,
    createdBy: userId,
  });
}
