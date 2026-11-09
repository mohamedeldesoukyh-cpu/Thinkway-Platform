"use server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCreatorFromRefLookup, resolveUnifiedCreatorsByRefs } from "@/lib/creators/unified-browse";
import { mapItem } from "@/lib/services/quotations/quotation-document-service";
import { resolveLineAvatarFields } from "@/lib/services/quotations/enrich-quotation-item-avatars";
import { loadShortlistLiveStatuses } from "@/features/discovery/shortlists/enrichment-live-status";
import { QUOTATION_PERMISSIONS } from "./constants";

/** Read-only display updates, scoped by session RLS and quotation. */
export async function getQuotationEnrichmentUpdates(quotationId: string, itemIds: string[]) {
  if (!quotationId || !itemIds.length || itemIds.length > 100) throw new Error("Invalid enrichment request.");
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("error" in auth) throw new Error(auth.error);
  const { data: quotation, error: accessError } = await supabase.from("quotations").select("id").eq("id", quotationId).maybeSingle();
  if (accessError || !quotation) throw new Error("Quotation is not accessible.");
  const { data, error } = await supabase.from("quotation_items").select("*").eq("quotation_id", quotationId).in("id", itemIds);
  if (error) throw new Error(error.message);
  const items = (data ?? []).map(mapItem);
  // Read status before metrics so completion includes the final metrics snapshot.
  const statuses = await loadShortlistLiveStatuses(supabase, items);
  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map(item => item.unified_id),
    influencerIds: items.map(item => item.influencer_id),
    discoveredProfileIds: items.map(item => item.profile_id),
  });
  return items.flatMap(item => {
    const creator = resolveCreatorFromRefLookup(lookup, item);
    if (!creator) return [];
    const fields = resolveLineAvatarFields({ ...item, followers: null, engagement_rate: null, avg_views: null }, creator, undefined);
    const status = creator.influencer_id ? statuses.get(creator.influencer_id) : undefined;
    // Never overlay editable platform, service or commercial values.
    return [{ id: item.id, followers: fields.followers, engagement_rate: fields.engagement_rate,
      avg_views: fields.avg_views, profile_image_url: fields.profile_image_url, profile_url: fields.profile_url,
      country_code: fields.country_code, creator_categories: fields.creator_categories,
      creator_categories_manual: fields.creator_categories_manual,
      creator_profile_source: { ...fields.creator_profile_source,
        enrichmentDisplayStatus: status ?? creator.enrichment_status ?? fields.creator_profile_source.enrichmentDisplayStatus },
    }];
  });
}
