import { NextResponse } from "next/server";

import {
  getDailyDrilldown,
  parseDailyDrilldownSearchParams,
} from "@/lib/analytics/queries/daily-report";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string | string[] | undefined> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const query = parseDailyDrilldownSearchParams(params);
  if (!query) {
    return NextResponse.json({ error: "Invalid drill-down parameters" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "analytics.read");
  if ("response" in auth) return auth.response;

  try {
    const drilldown = await getDailyDrilldown(query);
    return NextResponse.json(drilldown);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load drill-down";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
