import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

import { getVendorAssignmentsForMovement } from "@/features/operations/queries";
import { operationsVendorIdParamSchema } from "@/lib/validation/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "operations.read");
  if ("response" in auth) return auth.response;

  try {
    const { id } = await params;
    const parsed = operationsVendorIdParamSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "validation_error",
          message: "Invalid vendor id.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join(".") || "id",
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    const assignments = await getVendorAssignmentsForMovement(parsed.data.id);
    return NextResponse.json({ assignments });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load assignments.",
      },
      { status: 500 }
    );
  }
}
