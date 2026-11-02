import type { SupabaseClient } from "@supabase/supabase-js";
import { assignmentInstallmentNumbers } from "@/lib/billing/invoice-installments";

type History = { id: string; created_at: string; status: string };
type Line = { invoice_id: string; campaign_line_id: string | null; revenue_before_vat: number; description: string };
type Invoice = { id: string; campaign_name?: string | null };

/** Build short statement labels from saved percentages, never from invoice totals. */
export function statementCampaignLabels(invoices: Invoice[], history: History[], lines: Line[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const invoice of invoices) {
    const campaign = invoice.campaign_name?.trim();
    if (!campaign) continue;
    const current = lines.filter(line => line.invoice_id === invoice.id && Number(line.revenue_before_vat) > 0);
    const ordinals = assignmentInstallmentNumbers(invoice.id, history, lines);
    const parts = current.map(line => {
      const match = line.description.match(/(\d+(?:\.\d+)?)% of original billable amount/i);
      const percent = match ? Number(match[1]) : null;
      const ordinal = line.campaign_line_id ? ordinals.get(line.campaign_line_id) : undefined;
      if (percent == null || percent <= 0 || percent > 100 || !ordinal) return null;
      const suffix = ordinal % 100 >= 11 && ordinal % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'} as Record<number,string>)[ordinal % 10] ?? 'th';
      return `${ordinal > 1 ? `${ordinal}${suffix} ` : ''}${percent}%`;
    });
    // Mixed or incomplete installment data must not imply one percentage for the whole invoice.
    const uniform = parts.length > 0 && parts.every(part => part != null && part === parts[0]);
    result.set(invoice.id, uniform ? `${parts[0]} of “${campaign}”` : campaign);
  }
  return result;
}

export async function loadStatementCampaignLabels(db: SupabaseClient, invoices: Invoice[]): Promise<Map<string, string>> {
  const history: History[] = [];
  const lines: Line[] = [];
  for (let offset = 0; offset < invoices.length; offset += 100) {
    const ids = invoices.slice(offset, offset + 100).map(invoice => invoice.id);
    const { data, error } = await db.from('invoices').select('id, created_at, status').in('id', ids);
    if (error) throw new Error('Unable to load statement installment history.');
    history.push(...(data ?? []));
    for (let start = 0; ; start += 500) {
      const { data: rows, error: lineError } = await db.from('invoice_line_items')
        .select('invoice_id, campaign_line_id, revenue_before_vat, description').in('invoice_id', ids)
        .order('id').range(start, start + 499);
      if (lineError) throw new Error('Unable to load statement installment details.');
      lines.push(...(rows ?? []));
      if ((rows?.length ?? 0) < 500) break;
    }
  }
  return statementCampaignLabels(invoices, history, lines);
}
