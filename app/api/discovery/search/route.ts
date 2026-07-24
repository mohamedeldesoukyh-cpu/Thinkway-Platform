import { NextResponse } from "next/server";

import { logDiscoveryApiBoundary } from "@/lib/observability/discovery-metrics";
import { captureException } from "@/lib/observability/error-reporter";
import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type { DiscoveryPlatform } from "@/lib/discovery/types";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSearchParamsWithSchema } from "@/lib/validation/http";
import { discoverySearchQuerySchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.read");
  if ("response" in auth) return auth.response;

  const parsedQuery = parseSearchParamsWithSchema(
    searchParams,
    discoverySearchQuerySchema
  );
  if (!parsedQuery.ok) return parsedQuery.response;
  const query = parsedQuery.data;

  try {
    const result = await searchDiscoveredProfiles(supabase, {
      q: query.q,
      platform: (query.platform as DiscoveryPlatform) || undefined,
      country: query.country,
      city: query.city,
      category: query.category,
      language: query.language,
      minFollowers: query.minFollowers,
      maxFollowers: query.maxFollowers,
      minEngagement: query.minEngagement,
      minViews: query.minViews,
      page: query.page,
      pageSize: query.pageSize,
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
