import { NextResponse } from "next/server";

import { persistClientDocumentUpload } from "@/lib/clients/persist-client-document-upload";
import { friendlyClientDocumentError } from "@/lib/clients/client-document-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { clientId } = await context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const routeClientId = String(formData.get("client_id") ?? clientId);
    const documentType = String(formData.get("document_type") ?? "");
    const expiresAt = String(formData.get("expires_at") ?? "");
    const file = formData.get("file");

    if (routeClientId !== clientId) {
      return NextResponse.json(
        { ok: false, message: "Client reference mismatch." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Please choose a file to upload.",
          fieldErrors: { file: ["File is required"] },
        },
        { status: 400 }
      );
    }

    const result = await persistClientDocumentUpload({
      supabase,
      userId: user.id,
      clientId: routeClientId,
      documentType,
      file,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly.";
    return NextResponse.json(
      { ok: false, message: friendlyClientDocumentError(message) },
      { status: 500 }
    );
  }
}
