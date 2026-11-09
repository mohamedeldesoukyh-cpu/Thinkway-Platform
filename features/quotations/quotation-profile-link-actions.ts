"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import { findDuplicatePlatformAccounts } from "@/lib/social/duplicate-check";
import { addCreatorByProfileUrl } from "@/lib/discovery/add-creator-by-profile-url";
import { buildQuotationSeedFromCreator } from "@/lib/commercial-sync/shortlist-seeds";
import { addItemsToQuotation } from "@/lib/services/quotations/quotation-service";
import { QUOTATION_PERMISSIONS, quotationDetailPath } from "./constants";
import { parseQuotationProfileLinks, quotationCreatorIdentityKeys, QUOTATION_LINK_LIMIT, type QuotationLinkPreview, type QuotationLinkOutcome } from "./quotation-profile-links";

async function context(quotationId: string) {
  const supabase = await createSupabaseServerClient();
  let auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
  if ("error" in auth) throw new Error(auth.error);
  const { data, error } = await supabase.from("quotations").select("id,status,is_archived").eq("id", quotationId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Quotation not found.");
  if (data.is_archived || data.status === "approved" || data.status === "archived") throw new Error("This quotation is locked. Reopen it before adding creators.");
  return { supabase, userId: auth.userId };
}

async function existingKeys(supabase: Awaited<ReturnType<typeof context>>["supabase"], quotationId: string) {
  const { data, error } = await supabase.from("quotation_items")
    .select("influencer_id,profile_id,unified_id,profile_url,platform,handle").eq("quotation_id", quotationId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).flatMap(quotationCreatorIdentityKeys));
}

export async function previewQuotationProfileLinks(quotationId: string, raw: string): Promise<
  { ok: true; preview: QuotationLinkPreview } | { ok: false; message: string }
> {
  try {
    const { supabase } = await context(quotationId);
    const parsed = parseQuotationProfileLinks(raw);
    if (parsed.profiles.length > QUOTATION_LINK_LIMIT) throw new Error(`Paste up to ${QUOTATION_LINK_LIMIT} unique profile links per batch.`);
    const keys = await existingKeys(supabase, quotationId);
    const seen = new Set<string>();
    const preview: QuotationLinkPreview = { detected: parsed.profiles.length, duplicates: parsed.duplicates, alreadyInDiscovery: 0, alreadyInQuotation: 0, newCreators: 0, toAdd: 0, invalid: parsed.invalid };
    for (const profile of parsed.profiles) {
      const matches = await findDuplicatePlatformAccounts(supabase, profile);
      const id = matches[0]?.influencer_id;
      const identity = id ? `inf:${id}` : `url:${profile.normalized_profile_url}`;
      if (seen.has(identity)) { preview.duplicates++; continue; }
      seen.add(identity);
      if (id) preview.alreadyInDiscovery++; else preview.newCreators++;
      const candidates = quotationCreatorIdentityKeys({ influencer_id: id, profile_url: profile.normalized_profile_url, platform: profile.platform, handle: profile.normalized_username });
      if (candidates.some(key => keys.has(key))) preview.alreadyInQuotation++;
      else preview.toAdd++;
    }
    return { ok: true, preview };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not check profile links." }; }
}

export async function addQuotationProfileLinks(quotationId: string, raw: string): Promise<
  { ok: true; outcome: QuotationLinkOutcome } | { ok: false; message: string }
> {
  try {
    const { supabase, userId } = await context(quotationId);
    const parsed = parseQuotationProfileLinks(raw);
    if (!parsed.profiles.length) throw new Error("Paste at least one supported creator profile link.");
    if (parsed.profiles.length > QUOTATION_LINK_LIMIT) throw new Error(`Paste up to ${QUOTATION_LINK_LIMIT} unique profile links per batch.`);
    // Keep creation/enrichment permissions identical to the existing link importer.
    const permission = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
    if ("error" in permission) throw new Error(permission.error);
    const outcome: QuotationLinkOutcome = { added: 0, skipped: 0, created: 0, existing: 0, failed: [], itemIds: [] };
    for (const profile of parsed.profiles) {
      const url = profile.normalized_profile_url;
      try {
        const keys = await existingKeys(supabase, quotationId);
        const matches = await findDuplicatePlatformAccounts(supabase, profile);
        const candidates = quotationCreatorIdentityKeys({ influencer_id: matches[0]?.influencer_id, profile_url: url, platform: profile.platform, handle: profile.normalized_username });
        if (candidates.some(key => keys.has(key))) { outcome.skipped++; continue; }
        const resolved = await addCreatorByProfileUrl(supabase, {
          profileUrl: url, actorId: userId,
          skipIfExists: true, returnExisting: true, skipPreviewEnrichment: true,
          tolerateEnrichmentFailure: true,
        });
        if (!resolved.ok) throw new Error(resolved.message);
        if (!resolved.creator) throw new Error("Profile could not be loaded. Retry this link shortly.");
        if (resolved.created) outcome.created++; else outcome.existing++;
        const seed = buildQuotationSeedFromCreator(resolved.creator);
        const latest = await existingKeys(supabase, quotationId);
        if (quotationCreatorIdentityKeys(seed).some(key => latest.has(key))) { outcome.skipped++; continue; }
        const added = await addItemsToQuotation(supabase, quotationId, [seed]);
        if (!added.ok) throw new Error(added.message);
        outcome.added += added.data?.added ?? 0;
        outcome.itemIds.push(...(added.data?.itemIds ?? []));
      } catch (error) {
        outcome.failed.push({ url, message: error instanceof Error ? error.message : "Could not add creator." });
      }
    }
    revalidatePath(quotationDetailPath(quotationId));
    revalidatePath("/discovery/quotations");
    revalidatePath("/discovery/search");
    return { ok: true, outcome };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not import creators." }; }
}
