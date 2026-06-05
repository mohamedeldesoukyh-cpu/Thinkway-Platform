import type { SupabaseClient } from "@supabase/supabase-js";

type VendorIoRow = {
  id: string;
  document_number: string | null;
  is_superseded: boolean;
  root_vendor_io_id: string | null;
  revision_number: number;
};

/**
 * Resolve display document numbers for line vendor_io_id values.
 * If a line still points at a superseded row, follows root_vendor_io_id to the active revision.
 */
export async function buildActiveVendorIoDocumentMap(
  supabase: SupabaseClient,
  vendorIoIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(vendorIoIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data: rows, error } = await supabase
    .from("vendor_ios")
    .select("id, document_number, is_superseded, root_vendor_io_id, revision_number")
    .in("id", unique);

  if (error) {
    console.warn("[vendor-io-document-map] load failed", { message: error.message });
    return map;
  }

  const supersededRoots = new Set<string>();

  for (const row of (rows ?? []) as VendorIoRow[]) {
    if (!row.is_superseded && row.document_number) {
      map.set(row.id, row.document_number);
      continue;
    }
    const root = row.root_vendor_io_id ?? row.id;
    supersededRoots.add(root);
  }

  if (supersededRoots.size === 0) return map;

  const { data: activeRows, error: activeError } = await supabase
    .from("vendor_ios")
    .select("id, document_number, root_vendor_io_id, revision_number")
    .in("root_vendor_io_id", [...supersededRoots])
    .eq("is_superseded", false)
    .order("revision_number", { ascending: false });

  if (activeError) {
    console.warn("[vendor-io-document-map] active revision load failed", {
      message: activeError.message,
    });
    return map;
  }

  const activeByRoot = new Map<string, VendorIoRow>();
  for (const active of (activeRows ?? []) as VendorIoRow[]) {
    const root = active.root_vendor_io_id ?? active.id;
    if (!activeByRoot.has(root)) activeByRoot.set(root, active);
  }

  for (const row of (rows ?? []) as VendorIoRow[]) {
    if (!row.is_superseded) continue;
    const root = row.root_vendor_io_id ?? row.id;
    const active = activeByRoot.get(root);
    if (active?.document_number) {
      map.set(row.id, active.document_number);
    }
  }

  return map;
}
