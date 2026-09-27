import { browseUnifiedCreatorsForPickerAction } from "@/features/campaigns/creator-discovery-actions";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

/** Read-only authenticated search, independent of the browser's Server Action queue. */
export async function POST(request: Request) {
  let filters: UnifiedCreatorBrowseFilters;
  try {
    const body = await request.text();
    if (body.length > 20_000) return Response.json({ error: "Search is too large." }, { status: 400 });
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    filters = parsed;
  } catch {
    return Response.json({ error: "Invalid search." }, { status: 400 });
  }
  try {
    const result = await browseUnifiedCreatorsForPickerAction(filters);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized";
    return Response.json({ error: unauthorized ? "Please sign in again." : "Could not search creators. Please retry." }, {
      status: unauthorized ? 401 : 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
