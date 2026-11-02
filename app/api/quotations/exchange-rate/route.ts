import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QUOTATION_PERMISSIONS } from "@/features/quotations/constants";
import { isCommercialCurrency } from "@/lib/commercial/fx-aggregation";
import { resolveQuotationDisplayRates } from "@/lib/commercial/quotation-fx-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const currency = (params.get("currency") || "").toUpperCase();
  const asOf = params.get("asOf") || null;
  if (!isCommercialCurrency(currency) || (asOf && (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))))) {
    return NextResponse.json({ error: "Invalid currency or date." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("response" in auth) return auth.response;
  try {
    const rates = await resolveQuotationDisplayRates(supabase, currency, asOf);
    return NextResponse.json({ currency, asOf, ...rates }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: `No exchange rate available for ${currency}${asOf ? ` on ${asOf}` : ""}.` }, { status: 422 });
  }
}
