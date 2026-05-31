'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/auth/session'
import {
  createClientRecord,
  updateClientRecord,
  softDeleteClient,
} from '@/lib/repositories/clients'
import { createClientSchema, updateClientSchema } from '@/lib/validators/client'

export interface ClientActionResult {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

const OPTIONAL_STRING_FIELDS = [
  'trading_name', 'parent_group', 'website', 'description',
  'tax_id', 'notes', 'account_manager_id', 'onboarded_at',
] as const

function coerceFormData(raw: Record<string, string>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...raw }
  for (const key of OPTIONAL_STRING_FIELDS) {
    if (data[key] === '') data[key] = null
  }
  if (raw.payment_terms_days !== undefined && raw.payment_terms_days !== '') {
    data.payment_terms_days = Number(raw.payment_terms_days)
  }
  try {
    data.contacts = JSON.parse(raw.contacts || '[]')
  } catch {
    data.contacts = []
  }
  return data
}

export async function createClient(
  _prev: ClientActionResult,
  formData: FormData
): Promise<ClientActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>
  const parsed = createClientSchema.safeParse(coerceFormData(raw))

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const result = await createClientRecord(parsed.data, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath('/clients')
  return { success: true }
}

export async function updateClient(
  id: string,
  _prev: ClientActionResult,
  formData: FormData
): Promise<ClientActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>
  const parsed = updateClientSchema.safeParse(coerceFormData(raw))

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const result = await updateClientRecord(id, parsed.data, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath('/clients')
  return { success: true }
}

export async function deleteClient(id: string): Promise<ClientActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const result = await softDeleteClient(id, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath('/clients')
  return { success: true }
}
