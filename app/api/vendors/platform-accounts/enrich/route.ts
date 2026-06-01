import { NextResponse } from "next/server";
import { z } from "zod";

import { enrichPlatformAccount } from "@/lib/social/enrich-platform-account";

const bodySchema = z.object({
  profile_url: z.string().trim().optional(),
  username: z.string().trim().optional(),
  platform: z.string().trim().optional(),
  influencer_id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional(),
  skip_enrichment: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid enrichment request." },
        { status: 400 }
      );
    }

    if (!parsed.data.profile_url && !parsed.data.username) {
      return NextResponse.json(
        { error: "Provide a profile URL or username." },
        { status: 400 }
      );
    }

    const result = await enrichPlatformAccount(parsed.data);

    if (result.error && !result.parsed) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Enrichment request failed.",
      },
      { status: 500 }
    );
  }
}
