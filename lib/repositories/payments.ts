import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert, TablesUpdate, PaymentStatusDb } from '@/types/database'
import type { RepoResult, RepoList, ListParams } from '@/lib/database'
import { pgError, pageRange } from '@/lib/database'
import type { CreatePaymentInput, UpdatePaymentInput, MarkPaymentPaidInput } from '@/lib/validators/payment'

export type Payment = Tables<'payments'>

export async function listPayments(
  params: ListParams & {
    status?:    PaymentStatusDb
    vendorId?:  string
    campaignId?: string
  } = {}
): Promise<RepoList<Payment>> {
  const supabase = await createClient()
  const { page = 1, pageSize = 25, status, vendorId, campaignId, orderBy = 'created_at', orderDir = 'desc' } = params
  const [from, to] = pageRange(page, pageSize)

  let query = supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order(orderBy, { ascending: orderDir === 'asc' })
    .range(from, to)

  if (status)     query = query.eq('status', status)
  if (vendorId)   query = query.eq('vendor_id', vendorId)
  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data, error, count } = await query

  if (error) return { data: null, error: pgError(error) }
  return { data: { rows: data ?? [], total: count ?? 0 }, error: null }
}

export async function getPaymentById(id: string): Promise<RepoResult<Payment>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function createPaymentRecord(
  payload: CreatePaymentInput,
  actorId: string
): Promise<RepoResult<Payment>> {
  const supabase = await createClient()

  const insertData: TablesInsert<'payments'> = {
    vendor_id:      payload.vendor_id,
    campaign_id:    payload.campaign_id ?? null,
    deliverable_id: payload.deliverable_id ?? null,
    status:         payload.status ?? 'pending',
    amount:         payload.amount,
    currency:       payload.currency ?? 'USD',
    payment_method: payload.payment_method ?? 'bank_transfer',
    reference:      payload.reference ?? null,
    notes:          payload.notes ?? null,
    due_date:       payload.due_date ?? null,
    created_by:     actorId,
    updated_by:     actorId,
  }

  const { data, error } = await supabase
    .from('payments')
    .insert(insertData)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function updatePaymentRecord(
  id: string,
  payload: UpdatePaymentInput,
  actorId: string
): Promise<RepoResult<Payment>> {
  const supabase = await createClient()

  const updateData: TablesUpdate<'payments'> = { ...payload, updated_by: actorId }

  const { data, error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function markPaymentPaid(
  id: string,
  payload: MarkPaymentPaidInput,
  actorId: string
): Promise<RepoResult<Payment>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payments')
    .update({
      status:     'completed',
      paid_at:    payload.paid_at ?? new Date().toISOString(),
      reference:  payload.reference ?? null,
      updated_by: actorId,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function cancelPayment(id: string, actorId: string): Promise<RepoResult<Payment>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'cancelled', updated_by: actorId })
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}
