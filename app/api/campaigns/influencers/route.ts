import { NextResponse } from "next/server";

import {
  getInfluencerForAssignment,
  searchInfluencersForCampaign,
} from "@/features/campaigns/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const platform = searchParams.get("platform") ?? undefined;

  try {
    const results = await searchInfluencersForCampaign({
      search: q,
      platform,
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
