import { NextResponse } from "next/server";

import { requireOperationsCenterAccess } from "@/features/operations-center/auth";
import { buildOperationsCenterSnapshot } from "@/features/operations-center/services/build-snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Internal-only Operations Center snapshot API.
 * Never public — requires Super Admin / Admin / Operations / DevOps.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const auth = await requireOperationsCenterAccess(supabase);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: "OPS_CENTER_FORBIDDEN" },
      { status: auth.status },
    );
  }

  try {
    const snapshot = await buildOperationsCenterSnapshot(supabase);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Snapshot failed",
      },
      { status: 500 },
    );
  }
}
