import { NextResponse } from "next/server";

import { getCreatorImportFiles } from "@/features/discovery-import/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const files = await getCreatorImportFiles();
    return NextResponse.json({ files });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load import history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
