'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { QUOTATION_PERMISSIONS } from '@/lib/domains/commercial/quotation-constants';
import { requirePermission } from '@/lib/auth/permissions-server';
import type { MediaRecord, MediaRecordKind } from '@/lib/navigation/media-records';

const sources = {
  campaigns: { table: 'campaign_headers', number: 'document_number', permission: 'campaigns.read' },
  quotations: { table: 'quotations', number: 'serial_number', permission: QUOTATION_PERMISSIONS.read },
  shortlists: { table: 'discovery_shortlists', number: 'serial_number', permission: 'discovery.read' },
} as const;

export async function loadMediaRecords(kind: MediaRecordKind): Promise<{rows: MediaRecord[]; error?: string}> {
  if (!Object.hasOwn(sources, kind)) return { rows: [], error: 'Unknown record type.' };
  const source = sources[kind];
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, source.permission);
  if ('error' in auth) return { rows: [], error: auth.error };
  const rows: MediaRecord[] = [];
  // Fetch all permitted records in stable pages so Last is not the end of a server page.
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from(source.table)
      .select(`id,name,${source.number},client:clients!client_id(name)${kind === 'quotations' ? ',temporary_client_name' : ''}`)
      .order('id').range(offset, offset + 999);
    if (kind === 'shortlists') query = query.filter('is_archived', 'eq', false);
    const { data, error } = await query;
    if (error) return { rows: [], error: 'Could not load records. Please try again.' };
    const page = (data ?? []) as unknown as Array<Record<string, unknown>>;
    for (const row of page) {
      const client = (Array.isArray(row.client) ? row.client[0] : row.client) as {name?: string} | null;
      rows.push({id: String(row.id), number: String(row[source.number] ?? ''), name: String(row.name ?? ''), client: client?.name || String(row.temporary_client_name ?? '')});
    }
    if (page.length < 1000) break;
  }
  rows.sort((a,b) => a.number && b.number ? a.number.localeCompare(b.number, 'en', {numeric:true}) || a.id.localeCompare(b.id) : a.number ? -1 : b.number ? 1 : a.id.localeCompare(b.id));
  return { rows };
}

