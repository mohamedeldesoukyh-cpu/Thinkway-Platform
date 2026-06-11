import { NextResponse } from "next/server";

import {
  getInfluencerForAssignment,
  searchInfluencersForCampaign,
} from "@/features/campaigns/queries";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { unifiedToInfluencerSearch } from "@/lib/creators/adapters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseNumber(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "search";

  try {
    if (mode === "browse") {
      const supabase = await createSupabaseServerClient();
      const unified = await browseUnifiedCreators(supabase, {
        search: searchParams.get("q") ?? undefined,
        platform: searchParams.get("platform") ?? undefined,
        country: searchParams.get("country") ?? undefined,
        city: searchParams.get("city") ?? undefined,
        category: searchParams.get("category") ?? undefined,
        language: searchParams.get("language") ?? undefined,
        minFollowers: parseNumber(searchParams.get("minFollowers")),
        maxFollowers: parseNumber(searchParams.get("maxFollowers")),
        minEngagement: parseNumber(searchParams.get("minEngagement")),
        minViews: parseNumber(searchParams.get("minViews")),
        minThinkwayScore: parseNumber(searchParams.get("minThinkwayScore")),
        minAiScore: parseNumber(searchParams.get("minAiScore")),
        verifiedOnly: searchParams.get("verifiedOnly") === "true",
        source:
          (searchParams.get("source") as
            | "internal"
            | "public_discovery"
            | "oauth_verified"
            | "imported"
            | "all"
            | null) ?? undefined,
        page: Number(searchParams.get("page") ?? 1),
        pageSize: Number(searchParams.get("pageSize") ?? 20),
      });

      const creators = unified.creators
        .map((creator) => unifiedToInfluencerSearch(creator))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      return NextResponse.json({
        creators,
        unified_creators: unified.creators,
        total: unified.total,
        page: unified.page,
        pageSize: unified.pageSize,
        internal_count: unified.internal_count,
        discovery_count: unified.discovery_count,
      });
    }

    const results = await searchInfluencersForCampaign({
      search: searchParams.get("q") ?? "",
      platform: searchParams.get("platform") ?? undefined,
      limit: 25,
    });
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Missing influencer id." }, { status: 400 });
    }
    const profile = await getInfluencerForAssignment(body.id);
    if (!profile) {
      return NextResponse.json({ error: "Influencer not found." }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Load failed." },
      { status: 500 }
    );
  }
}
