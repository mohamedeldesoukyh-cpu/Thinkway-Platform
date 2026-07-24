import { NextResponse } from "next/server";

import {
  authorizeReadyDetailRequest,
  isReadyAdminRole,
} from "@/lib/auth/ready-auth";
import {
  buildReadinessReport,
  readinessHttpStatus,
} from "@/lib/observability/health-checks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PUBLIC_OK = { status: "ok" as const };

async function canViewDetailedReadiness(request: Request): Promise<boolean> {
  if (authorizeReadyDetailRequest(request)) {
    return true;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role:roles(slug)")
      .eq("id", user.id)
      .maybeSingle();

    type ProfileRow = { role: { slug: string } | null };
    const roleSlug = (profile as ProfileRow | null)?.role?.slug ?? null;
    return isReadyAdminRole(roleSlug);
  } catch {
    return false;
  }
}

/**
 * Public readiness: `{ status: "ok" }` only.
 * Detailed infrastructure report requires READY_API_SECRET or admin session.
 */
export async function GET(request: Request) {
  const detailed = await canViewDetailedReadiness(request);

  if (!detailed) {
    return NextResponse.json(PUBLIC_OK, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const report = await buildReadinessReport(supabase);

    return NextResponse.json(report, {
      status: readinessHttpStatus(report.status),
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Readiness check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
