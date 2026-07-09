import { NextResponse } from "next/server";

import { logDiscoveryApiBoundary } from "@/lib/observability/discovery-metrics";
import { captureException } from "@/lib/observability/error-reporter";
import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type { DiscoveryPlatform } from "@/lib/discovery/types";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.read");
  if ("response" in auth) return auth.response;

  try {
    const result = await searchDiscoveredProfiles(supabase, {
      q: searchParams.get("q") ?? undefined,
      platform: (searchParams.get("platform") as DiscoveryPlatform) || undefined,
      country: searchParams.get("country") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      language: searchParams.get("language") ?? undefined,
      minFollowers: searchParams.get("minFollowers")
        ? Number(searchParams.get("minFollowers"))
        : undefined,
      maxFollowers: searchParams.get("maxFollowers")
        ? Number(searchParams.get("maxFollowers"))
        : undefined,
      minEngagement: searchParams.get("minEngagement")
        ? Number(searchParams.get("minEngagement"))
        : undefined,
      minViews: searchParams.get("minViews") ? Number(searchParams.get("minViews")) : undefined,
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 24,
    });

    logDiscoveryApiBoundary({
      route: "/api/discovery/search",
      startedAt,
      status: 200,
      userId: auth.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    captureException(error, {
      route: "/api/discovery/search",
      service: "discovery-api",
      userId: auth.userId,
      status: 500,
    });
    logDiscoveryApiBoundary({
      route: "/api/discovery/search",
      startedAt,
      status: 500,
      userId: auth.userId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
