import { NextResponse } from "next/server";

import { getCampaignsForMovement } from "@/features/operations/queries";
import type { MovementType } from "@/features/operations/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const result = await getCampaignsForMovement({
      movementType: (searchParams.get("movementType") ??
        "brand_to_brand") as MovementType,
      groupId: searchParams.get("groupId") ?? undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      brandId: searchParams.get("brandId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load campaigns." },
      { status: 500 }
    );
  }
}
