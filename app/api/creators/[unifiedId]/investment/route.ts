import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import { enrichCreatorsWithEciInvestment } from "@/features/discovery/services/eci/enrich-creators-with-eci";

// Independent reads must not block the browser's serialized mutation queue.
export async function GET(_request: Request, context: { params: Promise<{ unifiedId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { unifiedId } = await context.params;
  const creator = await getUnifiedCreatorById(supabase, unifiedId, { skipDna: true });
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [enriched] = await enrichCreatorsWithEciInvestment(supabase, [creator]);
  return NextResponse.json({
    eci_investment_score: enriched?.eci_investment_score ?? null,
    eci_investment_recommendation: enriched?.eci_investment_recommendation ?? null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
