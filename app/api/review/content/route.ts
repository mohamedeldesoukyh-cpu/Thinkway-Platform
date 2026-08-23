import { NextResponse } from "next/server";

import { createClientContentSignedUrl } from "@/features/client-workspace/content-decisions";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("sign")?.trim() || "";
  const versionId = searchParams.get("versionId")?.trim() || "";
  const mode = searchParams.get("mode") === "download" ? "download" : "preview";
  if (token.length < 16 || !versionId) {
    return NextResponse.json({ error: "This review link is not available." }, { status: 401 });
  }

  const result = await createClientContentSignedUrl({ token, versionId, mode });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.redirect(result.url, 302);
}
