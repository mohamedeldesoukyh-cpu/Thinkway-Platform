import type { VendorIoRow } from "@/lib/domains/io/types";

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>;

export async function loadVendorIoReopenEligibility(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string,{eligible:boolean;reason:string|null}>();
  const {data,error} = await supabase.rpc("vendor_io_reopen_eligibility" as never, {p_ios:[...new Set(ids)]} as never);
  if(error) return new Map(ids.map(id=>[id,{eligible:false,reason:"Unable to verify payment and invoice status. Refresh and try again."}]));
  return new Map(((data ?? []) as {io_id:string;eligible:boolean;reason:string|null}[]).map(check=>[check.io_id,check]));
}

export async function attachVendorIoUngenerateEligibility(supabase: SupabaseClient, rows: VendorIoRow[]): Promise<VendorIoRow[]> {
  if (!rows.length) return rows;
  const checks = await loadVendorIoReopenEligibility(supabase,rows.map(row=>row.id));
  return rows.map(row=>({ ...row,
    ungenerate_eligible: checks.get(row.id)?.eligible === true,
    ungenerate_ineligible_reason: checks.get(row.id)?.reason ?? null,
  }));
}
