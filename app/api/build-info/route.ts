import { NextResponse } from "next/server";

import { getBuildInfo } from "@/lib/deploy/build-info";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const build = getBuildInfo();

  let schema: {
    authenticatedProbe: boolean;
    operationalStatusReadable: boolean | null;
    vendorIoSupersededReadable: boolean | null;
    note: string | null;
  } = {
    authenticatedProbe: false,
    operationalStatusReadable: null,
    vendorIoSupersededReadable: null,
    note: "Schema probes require a signed-in session (RLS). Sign in and open this URL again for row-level checks.",
  };

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      schema.authenticatedProbe = true;
      schema.note = null;
      const lineProbe = await supabase
        .from("campaign_lines")
        .select("operational_status")
        .limit(1);
      schema.operationalStatusReadable = !lineProbe.error;

      const vioProbe = await supabase
        .from("vendor_ios")
        .select("is_superseded")
        .limit(1);
      schema.vendorIoSupersededReadable = !vioProbe.error;

      if (lineProbe.error && vioProbe.error) {
        schema.note = lineProbe.error.message;
      }
    }
  } catch (error) {
    schema.note = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(
    {
      ...build,
      schema,
      hints: build.supabaseAligned
        ? []
        : [
            "Production NEXT_PUBLIC_SUPABASE_URL does not match the project where migrations were applied (thinkway-dev / hsxrewjcbvmbkqdlzjhs).",
            "Update Vercel Production env vars, then redeploy.",
          ],
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
