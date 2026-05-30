import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert, TablesUpdate, InvoiceStatusDb } from '@/types/database'
import type { RepoResult, RepoList, ListParams } from '@/lib/database'
import { pgError, pageRange } from '@/lib/database'
import type { CreateInvoiceInput, UpdateInvoiceInput } from '@/lib/validators/invoice'

export type Invoice         = Tables<'invoices'>
export type InvoiceLineItem = Tables<'invoice_line_items'>

export type InvoiceWithLines = Invoice & { line_items: InvoiceLineItem[] }

export async function listInvoices(
  params: ListParams & {
    status?:    InvoiceStatusDb
    clientId?:  string
    campaignId?: string
  } = {}
): Promise<RepoList<Invoice>> {
  const supabase = await createClient()
  const { page = 1, pageSize = 25, status, clientId, campaignId, orderBy = 'created_at', orderDir = 'desc' } = params
  const [from, to] = pageRange(page, pageSize)

  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order(orderBy, { ascending: orderDir === 'asc' })
    .range(from, to)

  if (status)     query = query.eq('status', status)
  if (clientId)   query = query.eq('client_id', clientId)
  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data, error, count } = await query

  if (error) return { data: null, error: pgError(error) }
  return { data: { rows: data ?? [], total: count ?? 0 }, error: null }
}

export async function getInvoiceById(id: string): Promise<RepoResult<InvoiceWithLines>> {
  const supabase = await createClient()

  const [invoiceRes, linesRes] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('sort_order'),
  ])

  if (invoiceRes.error) return { data: null, error: pgError(invoiceRes.error) }
  return {
    data: { ...invoiceRes.data, line_items: linesRes.data ?? [] },
    error: null,
  }
}

export async function createInvoiceRecord(
  payload: CreateInvoiceInput,
  actorId: string
): Promise<RepoResult<InvoiceWithLines>> {
  const supabase = await createClient()
  const { line_items, ...invoiceData } = payload

  const subtotal = line_items.reduce((sum, item) => {
    const discounted = item.unit_price * item.quantity * (1 - (item.discount_pct ?? 0) / 100)
    return sum + discounted
  }, 0)
  const taxAmount  = subtotal * (invoiceData.tax_rate ?? 0)
  const totalAmount = subtotal + taxAmount

  const insertData: TablesInsert<'invoices'> = {
    client_id:    invoiceData.client_id,
    campaign_id:  invoiceData.campaign_id ?? null,
    status:       invoiceData.status ?? 'draft',
    issue_date:   invoiceData.issue_date,
    due_date:     invoiceData.due_date,
    currency:     invoiceData.currency ?? 'USD',
    subtotal,
    tax_rate:     invoiceData.tax_rate ?? 0,
    tax_amount:   taxAmount,
    total_amount: totalAmount,
    paid_amount:  0,
    notes:        invoiceData.notes ?? null,
    terms:        invoiceData.terms ?? null,
    po_number:    invoiceData.po_number ?? null,
    legal_entity: invoiceData.legal_entity ?? null,
    created_by:   actorId,
    updated_by:   actorId,
  }

  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .insert(insertData)
    .select('*')
    .single()

  if (invoiceErr) return { data: null, error: pgError(invoiceErr) }

  const lineInserts = line_items.map((item, idx) => ({
    invoice_id:     invoice.id,
    description:    item.description,
    campaign_id:    item.campaign_id ?? null,
    vendor_id:      item.vendor_id ?? null,
    deliverable_id: item.deliverable_id ?? null,
    quantity:       item.quantity ?? 1,
    unit_price:     item.unit_price ?? 0,
    discount_pct:   item.discount_pct ?? 0,
    amount:         (item.unit_price ?? 0) * (item.quantity ?? 1) * (1 - (item.discount_pct ?? 0) / 100),
    sort_order:     item.sort_order ?? idx,
  }))

  const { data: lines, error: linesErr } = await supabase
    .from('invoice_line_items')
    .insert(lineInserts)
    .select('*')

  if (linesErr) return { data: null, error: pgError(linesErr) }
  return { data: { ...invoice, line_items: lines ?? [] }, error: null }
}

export async function updateInvoiceRecord(
  id: string,
  payload: UpdateInvoiceInput,
  actorId: string
): Promise<RepoResult<Invoice>> {
  const supabase = await createClient()
  const { line_items: _lines, ...fields } = payload

  const updateData: TablesUpdate<'invoices'> = { ...fields, updated_by: actorId }

  const { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function markInvoiceSent(id: string, actorId: string): Promise<RepoResult<Invoice>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_by: actorId })
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function voidInvoiceRecord(
  id: string,
  reason: string,
  actorId: string
): Promise<RepoResult<Invoice>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .update({
      status:      'void',
      voided_at:   new Date().toISOString(),
      void_reason: reason,
      updated_by:  actorId,
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}
