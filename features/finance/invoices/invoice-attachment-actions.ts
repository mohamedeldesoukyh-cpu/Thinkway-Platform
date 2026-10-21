"use server";
import { requirePermission } from '@/lib/auth/permissions-server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRequestUser } from '@/lib/supabase/server';
import { INVOICE_ATTACHMENT_BUCKET, validateInvoiceAttachment, type InvoiceAttachment } from './invoice-attachment-model';

async function invoiceAccess(invoiceId: string, write = false) {
  z.string().uuid().parse(invoiceId);
  const { supabase } = await requireRequestUser();
  const db = supabase as SupabaseClient;
  const permission = await requirePermission(db, write ? 'invoices.write' : 'invoices.read');
  if ('error' in permission) throw new Error(permission.error);
  const access = await db.rpc(write ? 'can_write_invoice_line_items' : 'can_read_invoice_line_items', { p_invoice_id: invoiceId });
  if (access.error || !access.data) throw new Error('Invoice access is required.');
  return { db };
}
const failure = (e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : 'Could not update invoice attachment.' });
export async function listInvoiceAttachments(invoiceId: string) {
  try {
    const { db } = await invoiceAccess(invoiceId);
    const { data, error } = await db.from('invoice_tax_attachments').select('id,file_name,mime_type,byte_size').eq('invoice_id', invoiceId).is('removed_at', null).not('uploaded_at', 'is', null).order('created_at');
    if (error) throw new Error(error.message);
    return { ok: true as const, proofs: (data ?? []) as InvoiceAttachment[] };
  } catch (e) { return failure(e); }
}
export async function prepareInvoiceAttachment(invoiceId: string, file: { name: string; type: string; size: number }) {
  try {
    const input = z.object({ name: z.string(), type: z.string(), size: z.number().int() }).parse(file);
    const issue = validateInvoiceAttachment(input); if (issue) throw new Error(issue);
    const { db } = await invoiceAccess(invoiceId, true);

    const id = randomUUID();
    const extension = input.type === 'application/pdf' ? 'pdf' : input.type.split('/')[1];
    const storagePath = `${invoiceId}/${id}.${extension}`;
    const saved = await db.from('invoice_tax_attachments').insert({ id, invoice_id: invoiceId, file_name: input.name, mime_type: input.type, byte_size: input.size, storage_path: storagePath });
    if (saved.error) throw new Error(saved.error.message);
    const signed = await db.storage.from(INVOICE_ATTACHMENT_BUCKET).createSignedUploadUrl(storagePath);
    if (signed.error) {
      await db.from('invoice_tax_attachments').update({ removed_at: new Date().toISOString() }).eq('id', id);
      throw new Error(signed.error.message);
    }
    return { ok: true as const, id, url: signed.data.signedUrl };
  } catch (e) { return failure(e); }
}
export async function completeInvoiceAttachment(invoiceId: string, attachmentId: string) {
  try {
    z.string().uuid().parse(attachmentId);
    const { db } = await invoiceAccess(invoiceId, true);
    const { data: proof, error } = await db.from('invoice_tax_attachments').select('storage_path,byte_size,mime_type').eq('id', attachmentId).eq('invoice_id', invoiceId).is('removed_at', null).single();
    if (error || !proof) throw new Error('Upload is unavailable. Please retry.');
    const leaf = proof.storage_path.split('/').pop();
    const objects = await db.storage.from(INVOICE_ATTACHMENT_BUCKET).list(invoiceId, { search: leaf });
    const object = objects.data?.find(o => o.name === leaf);
    if (objects.error || !object || Number(object.metadata?.size) !== proof.byte_size || object.metadata?.mimetype !== proof.mime_type) throw new Error('The upload is incomplete. Please retry.');
    const saved = await db.from('invoice_tax_attachments').update({ uploaded_at: new Date().toISOString() }).eq('id', attachmentId).eq('invoice_id', invoiceId).is('removed_at', null);
    if (saved.error) throw new Error(saved.error.message);
    return { ok: true as const };
  } catch (e) { return failure(e); }
}
export async function viewInvoiceAttachment(invoiceId: string, attachmentId: string) {
  try {
    z.string().uuid().parse(attachmentId);
    const { db } = await invoiceAccess(invoiceId);
    const { data: proof, error } = await db.from('invoice_tax_attachments').select('storage_path').eq('id', attachmentId).eq('invoice_id', invoiceId).is('removed_at', null).not('uploaded_at', 'is', null).single();
    if (error || !proof) throw new Error('This attachment is unavailable or has been removed.');
    const signed = await db.storage.from(INVOICE_ATTACHMENT_BUCKET).createSignedUrl(proof.storage_path, 60);
    if (signed.error) throw new Error(signed.error.message);
    return { ok: true as const, url: signed.data.signedUrl };
  } catch (e) { return failure(e); }
}
export async function removeInvoiceAttachment(invoiceId: string, attachmentId: string) {
  try {
    z.string().uuid().parse(attachmentId);
    const { db } = await invoiceAccess(invoiceId, true);
    // Soft removal preserves the audit record and never changes the payment.
    const result = await db.from('invoice_tax_attachments').update({ removed_at: new Date().toISOString() }).eq('id', attachmentId).eq('invoice_id', invoiceId);
    if (result.error) throw new Error(result.error.message);
    return { ok: true as const };
  } catch (e) { return failure(e); }
}

