import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";

export async function GET(_request: Request, context: { params: Promise<{ unifiedId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { unifiedId } = await context.params;
  const creator = await getUnifiedCreatorById(supabase, unifiedId);
  return NextResponse.json(creator ?? { error: "Not found" }, {
    status: creator ? 200 : 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
