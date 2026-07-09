import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { getVendorAssignmentsForMovement } from "@/features/operations/queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "operations.read");
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const assignments = await getVendorAssignmentsForMovement(id);
    return NextResponse.json({ assignments });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load assignments.",
      },
      { status: 500 }
    );
  }
}
