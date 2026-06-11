import { NextResponse } from "next/server";

import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type { DiscoveryPlatform } from "@/lib/discovery/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
