"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCreatorFromRefLookup, resolveUnifiedCreatorsByRefs } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { creatorDedupKeys } from "./creator-selection-utils";

export type CreatorSourceKind = "shortlist" | "campaign";
export type CreatorSourceOption = { id: string; name: string; code: string | null };
const sourceKind = z.enum(["shortlist", "campaign"]);
const pageSize = 500;

async function sourceClient(kind: CreatorSourceKind) {
  sourceKind.parse(kind);
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "discovery.read");
  if ("error" in auth) throw new Error(auth.error);
  if (kind === "campaign") {
    const campaignAuth = await requirePermission(supabase, "campaigns.read");
    if ("error" in campaignAuth) throw new Error(campaignAuth.error);
  }
  return supabase;
}

/** Use the caller's session/RLS, including private shortlist visibility. */
export async function listCreatorSources(kind: CreatorSourceKind): Promise<CreatorSourceOption[]> {
  const supabase = await sourceClient(kind);
  const options: CreatorSourceOption[] = [];
  for (let offset = 0; ; offset += pageSize) {
    if (kind === "shortlist") {
      const { data, error } = await supabase.from("discovery_shortlists")
        .select("id, name, serial_number").eq("is_archived", false)
        .order("created_at", { ascending: false }).order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      options.push(...(data ?? []).map((row) => ({ id: row.id, name: row.name, code: row.serial_number })));
      if ((data?.length ?? 0) < pageSize) break;
    } else {
      const { data, error } = await supabase.from("campaign_headers")
        .select("id, name, document_number")
        .order("created_at", { ascending: false }).order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      options.push(...(data ?? []).map((row) => ({ id: row.id, name: row.name, code: row.document_number })));
      if ((data?.length ?? 0) < pageSize) break;
    }
  }
  return options;
}

export async function listSourceCreators(kind: CreatorSourceKind, id: string): Promise<UnifiedCreatorResult[]> {
  z.string().uuid().parse(id);
  const supabase = await sourceClient(kind);
  const { data: source, error: sourceError } = await supabase
    .from(kind === "shortlist" ? "discovery_shortlists" : "campaign_headers")
    .select("id").eq("id", id).maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  if (!source) throw new Error("This source is unavailable or you do not have permission to view it.");

  const creators: UnifiedCreatorResult[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += pageSize) {
    const result = kind === "shortlist"
      ? await supabase.from("discovery_shortlist_items")
        .select("unified_id, profile_id, influencer_id").eq("shortlist_id", id)
        .order("sort_order").order("id").range(offset, offset + pageSize - 1)
      : await supabase.from("campaign_influencers")
        .select("influencer_id").eq("campaign_header_id", id)
        .or("shortlist_assignment_status.is.null,shortlist_assignment_status.neq.removed")
        .order("id").range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const refs = (result.data ?? []) as Array<{
      unified_id?: string | null; profile_id?: string | null; influencer_id: string | null;
    }>;
    // Bound hydration queries while still loading every member for Select all.
    for (let start = 0; start < refs.length; start += 100) {
      const batch = refs.slice(start, start + 100);
      const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
        unifiedIds: batch.map((row) => row.unified_id),
        influencerIds: batch.map((row) => row.influencer_id),
        discoveredProfileIds: batch.map((row) => row.profile_id),
      });
      for (const ref of batch) {
        const creator = resolveCreatorFromRefLookup(lookup, ref);
        if (!creator) continue;
        const keys = creatorDedupKeys(creator);
        const duplicate = keys.some((key) => seen.has(key));
        keys.forEach((key) => seen.add(key));
        if (!duplicate) creators.push(creator);
      }
    }
    if (refs.length < pageSize) break;
  }
  return creators;
}
