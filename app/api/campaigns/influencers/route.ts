import { NextResponse } from "next/server";

import {
  browseInfluencersForCampaign,
  getInfluencerForAssignment,
  searchInfluencersForCampaign,
} from "@/features/campaigns/queries";

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
      const result = await browseInfluencersForCampaign({
        search: searchParams.get("q") ?? undefined,
        platform: searchParams.get("platform") ?? undefined,
        country: searchParams.get("country") ?? undefined,
        category: searchParams.get("category") ?? undefined,
        minFollowers: parseNumber(searchParams.get("minFollowers")),
        maxFollowers: parseNumber(searchParams.get("maxFollowers")),
        minEngagement: parseNumber(searchParams.get("minEngagement")),
        page: Number(searchParams.get("page") ?? 1),
        pageSize: Number(searchParams.get("pageSize") ?? 20),
      });
      return NextResponse.json(result);
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
