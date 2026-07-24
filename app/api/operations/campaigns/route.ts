import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { getCampaignsForMovement } from "@/features/operations/queries";
import { parseSearchParamsWithSchema } from "@/lib/validation/http";
import { operationsCampaignsQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "operations.read");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsedQuery = parseSearchParamsWithSchema(
    searchParams,
    operationsCampaignsQuerySchema
  );
  if (!parsedQuery.ok) return parsedQuery.response;

  try {
    const result = await getCampaignsForMovement({
      movementType: parsedQuery.data.movementType,
      groupId: parsedQuery.data.groupId,
      clientId: parsedQuery.data.clientId,
      brandId: parsedQuery.data.brandId,
      search: parsedQuery.data.search,
      page: parsedQuery.data.page,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load campaigns." },
      { status: 500 }
    );
  }
}
