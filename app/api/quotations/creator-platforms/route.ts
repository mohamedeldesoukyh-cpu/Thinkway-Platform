import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { QUOTATION_PERMISSIONS } from "@/features/quotations/constants";
import { resolveUnifiedCreatorsByRefs, resolveCreatorFromRefLookup } from "@/lib/creators/unified-browse";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

const ref = z.object({
  unified_id: z.string().uuid().nullish(),
  influencer_id: z.string().uuid().nullish(),
  profile_id: z.string().uuid().nullish(),
});

/** Read-only batch: avoids one serialized Server Action and hydration per creator. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("response" in auth) return auth.response;
  const parsed = z.array(ref).max(100).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid creator references" }, { status: 400 });
  const refs = parsed.data;
  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: refs.map(r => r.unified_id),
    influencerIds: refs.map(r => r.influencer_id),
    discoveredProfileIds: refs.map(r => r.profile_id),
  }, { skipDna: false, omitHeavyFields: false });
  return NextResponse.json(refs.map(input => {
    const creator = resolveCreatorFromRefLookup(lookup, input);
    return (creator?.platforms ?? []).map(p => ({
      platform: canonicalPlatformKey(p.platform), handle: p.handle,
      followers: p.follower_count ?? null,
      engagement_rate: p.engagement_rate ?? creator?.metrics.engagement_rate.value ?? null,
    }));
  }), { headers: { "Cache-Control": "private, no-store" } });
}
