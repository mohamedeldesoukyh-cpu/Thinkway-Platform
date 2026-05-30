import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert, TablesUpdate, ClientStatusDb, ClientTierDb } from '@/types/database'
import type { RepoResult, RepoList, ListParams } from '@/lib/database'
import { pgError, pageRange } from '@/lib/database'
import type { CreateClientInput, UpdateClientInput, ClientContactInput } from '@/lib/validators/client'

export type Client        = Tables<'clients'>
export type ClientContact = Tables<'client_contacts'>

export type ClientWithContacts = Client & { contacts: ClientContact[] }

export async function listClients(
  params: ListParams & {
    status?:   ClientStatusDb
    tier?:     ClientTierDb
    industry?: string
    search?:   string
  } = {}
): Promise<RepoList<Client>> {
  const supabase = await createClient()
  const { page = 1, pageSize = 25, status, tier, industry, search, orderBy = 'name', orderDir = 'asc' } = params
  const [from, to] = pageRange(page, pageSize)

  let query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order(orderBy, { ascending: orderDir === 'asc' })
    .range(from, to)

  if (status)   query = query.eq('status', status)
  if (tier)     query = query.eq('tier', tier)
  if (industry) query = query.eq('industry', industry)
  if (search)   query = query.ilike('name', `%${search}%`)

  const { data, error, count } = await query

  if (error) return { data: null, error: pgError(error) }
  return { data: { rows: data ?? [], total: count ?? 0 }, error: null }
}

export async function getClientById(id: string): Promise<RepoResult<ClientWithContacts>> {
  const supabase = await createClient()

  const [clientRes, contactsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('client_contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }),
  ])

  if (clientRes.error) return { data: null, error: pgError(clientRes.error) }
  return {
    data: { ...clientRes.data, contacts: contactsRes.data ?? [] },
    error: null,
  }
}

export async function createClientRecord(
  payload: CreateClientInput,
  actorId: string
): Promise<RepoResult<ClientWithContacts>> {
  const supabase = await createClient()
  const { contacts = [], ...clientData } = payload

  const insertData: TablesInsert<'clients'> = {
    name:               clientData.name,
    trading_name:       clientData.trading_name ?? null,
    industry:           clientData.industry,
    tier:               clientData.tier ?? 'standard',
    status:             clientData.status ?? 'prospect',
    parent_group:       clientData.parent_group ?? null,
    website:            clientData.website ?? null,
    description:        clientData.description ?? null,
    tax_id:             clientData.tax_id ?? null,
    currency:           clientData.currency ?? 'USD',
    payment_terms_days: clientData.payment_terms_days ?? 30,
    account_manager_id: clientData.account_manager_id ?? null,
    notes:              clientData.notes ?? null,
    tags:               clientData.tags ?? [],
    address:            clientData.address ? (clientData.address as unknown as import('@/types/database').Json) : null,
    onboarded_at:       clientData.onboarded_at ?? null,
    created_by:         actorId,
    updated_by:         actorId,
  }

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .insert(insertData)
    .select('*')
    .single()

  if (clientErr) return { data: null, error: pgError(clientErr) }

  let savedContacts: ClientContact[] = []
  if (contacts.length > 0) {
    const contactInserts = contacts.map((c) => ({ ...c, client_id: client.id }))
    const { data: contactData } = await supabase
      .from('client_contacts')
      .insert(contactInserts)
      .select('*')
    savedContacts = contactData ?? []
  }

  return { data: { ...client, contacts: savedContacts }, error: null }
}

export async function updateClientRecord(
  id: string,
  payload: UpdateClientInput,
  actorId: string
): Promise<RepoResult<Client>> {
  const supabase = await createClient()
  // contacts handled separately via upsertClientContacts
  const { contacts: _contacts, ...fields } = payload as UpdateClientInput & { contacts?: ClientContactInput[] }

  const updateData: TablesUpdate<'clients'> = {
    ...fields,
    address: fields.address ? (fields.address as unknown as import('@/types/database').Json) : undefined,
    updated_by: actorId,
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function softDeleteClient(id: string, actorId: string): Promise<RepoResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { data: null, error: pgError(error) }
  return { data: null, error: null }
}

export async function upsertClientContacts(
  clientId: string,
  contacts: ClientContactInput[]
): Promise<RepoResult<ClientContact[]>> {
  const supabase = await createClient()

  await supabase.from('client_contacts').delete().eq('client_id', clientId)

  if (contacts.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from('client_contacts')
    .insert(contacts.map((c) => ({ ...c, client_id: clientId })))
    .select('*')

  if (error) return { data: null, error: pgError(error) }
  return { data: data ?? [], error: null }
}
