import type { SupabaseClient } from '@supabase/supabase-js';
import { paymentRowsByIds } from './query-pages';
export async function creatorPaymentBalances(db: SupabaseClient, assignmentIds: string[]) {
    const balances = new Map<string, {
        total: number;
        paid: number;
        reserved: number;
    }>();
    if (!assignmentIds.length)
        return balances;
    const result = await paymentRowsByIds(assignmentIds,ids=>db.from('creator_payment_balances').select('assignment_id,total,paid,reserved').in('assignment_id', ids).order('assignment_id'));
    for (const row of result.data ?? [])
        balances.set(row.assignment_id, { total: Number(row.total), paid: Number(row.paid), reserved: Number(row.reserved) });
    return balances;
}
