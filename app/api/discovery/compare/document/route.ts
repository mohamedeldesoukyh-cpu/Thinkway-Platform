import { NextResponse } from "next/server";

import { createPdfFromHtmlResponse } from "@/lib/reports/document/report-document-response";
import { loadCreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { renderCreatorCompareHtml } from "@/lib/creators/creator-compare-document";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.read");
  if ("response" in auth) return auth.response;

  let unifiedIds: string[] = [];
  try {
    const body = (await request.json()) as { unifiedIds?: string[] };
    unifiedIds = Array.isArray(body.unifiedIds) ? body.unifiedIds : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (unifiedIds.length < 2) {
    return NextResponse.json(
      { error: "At least 2 creators required for comparison" },
      { status: 400 }
    );
  }

  const bundle = await loadCreatorCompareBundle(supabase, unifiedIds);
  if (bundle.entries.length < 2) {
    return NextResponse.json({ error: "Creators not found" }, { status: 404 });
  }

  const html = renderCreatorCompareHtml(bundle);
  return createPdfFromHtmlResponse(html, `thinkway-creator-compare-${Date.now()}`, true);
}
