import type { SupabaseClient } from "@supabase/supabase-js";

type VendorIoLinkRow = {
  id: string;
  is_superseded: boolean;
  root_vendor_io_id: string | null;
  revision_number: number;
};

/**
 * Resolve the active (non-superseded) Vendor IO id for a line pointer.
 * Returns null when the pointer is missing, orphaned, or only superseded revisions exist.
 */
export async function resolveActiveVendorIoId(
  supabase: SupabaseClient,
  vendorIoId: string | null | undefined
): Promise<string | null> {
  if (!vendorIoId) return null;

  const { data: row, error } = await supabase
    .from("vendor_ios")
    .select("id, is_superseded, root_vendor_io_id, revision_number")
    .eq("id", vendorIoId)
    .maybeSingle();

  if (error || !row) return null;

  const typed = row as VendorIoLinkRow;
  if (!typed.is_superseded) return typed.id;

  const root = typed.root_vendor_io_id ?? typed.id;
  const { data: active, error: activeError } = await supabase
    .from("vendor_ios")
    .select("id")
    .eq("root_vendor_io_id", root)
    .eq("is_superseded", false)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError || !active) return null;
  return (active as { id: string }).id;
}

/** Batch-resolve active Vendor IO links for line vendor_io_id values. */
export async function buildActiveVendorIoLinkMap(
  supabase: SupabaseClient,
  vendorIoIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = [...new Set(vendorIoIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: rows, error } = await supabase
    .from("vendor_ios")
    .select("id, is_superseded, root_vendor_io_id, revision_number")
    .in("id", unique);

  if (error) {
    console.warn("[vendor-io-active-link] load failed", { message: error.message });
    for (const id of unique) map.set(id, null);
    return map;
  }

  const rowById = new Map<string, VendorIoLinkRow>();
  const supersededRoots = new Set<string>();

  for (const raw of (rows ?? []) as VendorIoLinkRow[]) {
    rowById.set(raw.id, raw);
    if (raw.is_superseded) {
      supersededRoots.add(raw.root_vendor_io_id ?? raw.id);
    }
  }

  const activeByRoot = new Map<string, string>();
  if (supersededRoots.size > 0) {
    const { data: activeRows, error: activeError } = await supabase
      .from("vendor_ios")
      .select("id, root_vendor_io_id, revision_number")
      .in("root_vendor_io_id", [...supersededRoots])
      .eq("is_superseded", false)
      .order("revision_number", { ascending: false });

    if (!activeError) {
      for (const active of (activeRows ?? []) as Array<{
        id: string;
        root_vendor_io_id: string | null;
      }>) {
        const root = active.root_vendor_io_id ?? active.id;
        if (!activeByRoot.has(root)) activeByRoot.set(root, active.id);
      }
    }
  }

  for (const id of unique) {
    const row = rowById.get(id);
    if (!row) {
      map.set(id, null);
      continue;
    }
    if (!row.is_superseded) {
      map.set(id, row.id);
      continue;
    }
    const root = row.root_vendor_io_id ?? row.id;
    map.set(id, activeByRoot.get(root) ?? null);
  }

  return map;
}
