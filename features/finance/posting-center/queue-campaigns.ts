import type { SupabaseClient } from '@supabase/supabase-js';

type QueueRow = { id: string; type: string; assignment?: string | null; invoice?: string | null };
const sourceTables: Record<string,string> = { client_invoice:'invoices', client_credit_note:'client_credit_notes', vendor_credit_note:'vendor_credit_notes', client_debit_note:'client_debit_notes', vendor_debit_note:'vendor_debit_notes' };

// Batch-read visible source rows and campaign names using the caller's RLS.
export async function queueCampaignNames<T extends QueueRow>(db: SupabaseClient, rows: T[]): Promise<(T & { campaign: string | null })[]> {
  const campaigns = new Map<string,string>();
  const lines = new Map<string,string>();
  const invoices = new Map<string,string>();
  async function read(table:string, ids:string[], target:Map<string,string>, prefix='') {
    if(!ids.length)return;
    const result=await db.from(table).select('id,campaign_header_id').in('id',[...new Set(ids)]);
    if(result.error)throw Error('Could not load document campaigns');
    for(const row of result.data??[])if(row.campaign_header_id)target.set(prefix+row.id,row.campaign_header_id);
  }
  await Promise.all([
    ...Object.entries(sourceTables).map(([type,table])=>read(table,rows.filter(r=>r.type===type).map(r=>r.id),campaigns,type+':')),
    read('campaign_lines',rows.map(r=>r.assignment).filter((id):id is string=>!!id),lines),
    read('invoices',rows.filter(r=>r.type.startsWith('client_')).map(r=>r.invoice).filter((id):id is string=>!!id),invoices),
  ]);
  const campaignId=(row:T)=>campaigns.get(row.type+':'+row.id)??lines.get(row.assignment??'')??invoices.get(row.invoice??'');
  const ids=[...new Set(rows.map(campaignId).filter((id):id is string=>!!id))];
  if(!ids.length)return rows.map(row=>({...row,campaign:null}));
  const result=await db.from('campaign_headers').select('id,name').in('id',ids);
  if(result.error)throw Error('Could not load campaign names');
  const names=new Map((result.data??[]).map(row=>[row.id,row.name]));
  return rows.map(row=>({...row,campaign:names.get(campaignId(row))??null}));
}
