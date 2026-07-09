import { NextResponse } from "next/server";

import {
  cancelAcquisitionSession,
  getAcquisitionSessionConfig,
  touchAcquisitionSessionHeartbeat,
} from "@/lib/discovery/acquisition-session";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SessionBody = {
  action?: "heartbeat" | "cancel";
  searchSessionId?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.write");
  if ("response" in auth) return auth.response;

  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const searchSessionId = body.searchSessionId?.trim();
  if (!searchSessionId) {
    return NextResponse.json({ error: "searchSessionId is required" }, { status: 400 });
  }

  const action = body.action === "cancel" ? "cancel" : "heartbeat";

  if (action === "heartbeat") {
    const ok = await touchAcquisitionSessionHeartbeat(searchSessionId);
    return NextResponse.json({
      ok,
      searchSessionId,
      config: getAcquisitionSessionConfig(),
    });
  }

  const result = await cancelAcquisitionSession(supabase, searchSessionId, {
    reason: "Cancelled — search session ended.",
  });

  return NextResponse.json(result);
}
