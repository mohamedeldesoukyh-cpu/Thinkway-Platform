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

  const hints: string[] = [];
  if (!build.supabaseAligned) {
    hints.push(
      `NEXT_PUBLIC_SUPABASE_URL project ref does not match expected ${build.expectedSupabaseProjectRef} for this environment (${build.environment}). Update Vercel env vars, then redeploy.`
    );
  }
  if (build.legacyAssignmentsEnvPresent) {
    hints.push(
      "Remove ASSIGNMENTS_RENDER_STAGE, NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE, and ASSIGNMENTS_ALLOW_RENDER_BISECT from Vercel, then redeploy."
    );
  }
  if (!build.gitSha) {
    hints.push(
      "gitSha is null — CLI Production deploys omit VERCEL_GIT_COMMIT_SHA. PWA updates use VERCEL_DEPLOYMENT_ID / build timestamp; prefer Vercel git integration when commit verification is required."
    );
  }

  return NextResponse.json(
    {
      ...build,
      schema,
      verify: {
        expectArchitectureVersion: build.architecture.version,
        expectNoRenderStageBanner: true,
        expectNoCampaignCreateBootstrap: true,
        checkUrl: "Open /api/build-info after deploy; gitSha must match latest main commit.",
      },
      hints,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
