"use server";

import { revalidatePath } from "next/cache";

import { matchCampaignBrief } from "@/lib/discovery/campaign-match";
import { enqueueDiscoveryJob, enqueueEnrichmentJob } from "@/lib/discovery/queue";
import type { CampaignMatchRequest, DiscoveryJobPayload } from "@/lib/discovery/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function startDiscoveryJobAction(payload: DiscoveryJobPayload) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: job, error } = await supabase
    .from("discovery_jobs")
    .insert({
      job_type: `discovery:${payload.method}`,
      method: payload.method,
      status: "pending",
      payload,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const queued = await enqueueDiscoveryJob(payload, job.id as string);
  revalidatePath("/discovery");
  return { jobId: job.id as string, queued };
}

export async function enrichDiscoveredProfileAction(profileId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: job, error } = await supabase
    .from("discovery_jobs")
    .insert({
      job_type: "enrichment:profile",
      status: "pending",
      payload: { profileId },
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const queued = await enqueueEnrichmentJob({ profileId }, job.id as string);
  revalidatePath("/discovery");
  return { jobId: job.id as string, queued };
}

export async function createShortlistAction(name: string, description?: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("discovery_shortlists")
    .insert({ name, description: description ?? null, owner_id: user.id })
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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const matches = await matchCampaignBrief(supabase, request);
  revalidatePath("/discovery");
  return matches;
}
