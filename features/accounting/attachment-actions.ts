"use server";
import { accountingContext } from './setup-server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { validateInvoiceAttachment, type InvoiceAttachment } from '../finance/invoices/invoice-attachment-model';

async function invoiceAccess(journalId:string,write=false){
 z.string().uuid().parse(journalId);const {db,access}=await accountingContext();
 if(write&&!access.manage)throw new Error('Accounting management access required.');
 const allowed=await db.rpc('tw_accounting_attachment_access',{p_journal:journalId,p_write:write});
 if(allowed.error||!allowed.data)throw new Error('Journal attachment access denied or transaction locked.');
 return {db};
}
const failure = (e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : 'Could not update accounting attachment.' });
export async function listAccountingAttachments(journalId: string) {
  try {
    const { db } = await invoiceAccess(journalId);
    const { data, error } = await db.from('tw_accounting_attachments').select('id,file_name,mime_type,byte_size').eq('journal_id', journalId).is('removed_at', null).not('uploaded_at', 'is', null).order('created_at');
    if (error) throw new Error(error.message);
    return { ok: true as const, proofs: (data ?? []) as InvoiceAttachment[] };
  } catch (e) { return failure(e); }
}
export async function prepareAccountingAttachment(journalId: string, file: { name: string; type: string; size: number }) {
  try {
    const input = z.object({ name: z.string(), type: z.string(), size: z.number().int() }).parse(file);
    const issue = validateInvoiceAttachment(input); if (issue) throw new Error(issue);
    const { db } = await invoiceAccess(journalId, true);

    const id = randomUUID();
    const extension = input.type === 'application/pdf' ? 'pdf' : input.type.split('/')[1];
    const storagePath = `${journalId}/${id}.${extension}`;
    const saved = await db.from('tw_accounting_attachments').insert({ id, journal_id: journalId, file_name: input.name, mime_type: input.type, byte_size: input.size, storage_path: storagePath });
    if (saved.error) throw new Error(saved.error.message);
    const signed = await db.storage.from('tw-accounting-attachments').createSignedUploadUrl(storagePath);
    if (signed.error) {
      await db.from('tw_accounting_attachments').update({ removed_at: new Date().toISOString() }).eq('id', id);
      throw new Error(signed.error.message);
    }
    return { ok: true as const, id, url: signed.data.signedUrl };
  } catch (e) { return failure(e); }
}
export async function completeAccountingAttachment(journalId: string, attachmentId: string) {
  try {
    z.string().uuid().parse(attachmentId);
    const { db } = await invoiceAccess(journalId, true);
    const { data: proof, error } = await db.from('tw_accounting_attachments').select('storage_path,byte_size,mime_type').eq('id', attachmentId).eq('journal_id', journalId).is('removed_at', null).single();
    if (error || !proof) throw new Error('Upload is unavailable. Please retry.');
    const leaf = proof.storage_path.split('/').pop();
    const objects = await db.storage.from('tw-accounting-attachments').list(journalId, { search: leaf });
    const object = objects.data?.find(o => o.name === leaf);
    if (objects.error || !object || Number(object.metadata?.size) !== proof.byte_size || object.metadata?.mimetype !== proof.mime_type) throw new Error('The upload is incomplete. Please retry.');
    const saved = await db.from('tw_accounting_attachments').update({ uploaded_at: new Date().toISOString() }).eq('id', attachmentId).eq('journal_id', journalId).is('removed_at', null);
    if (saved.error) throw new Error(saved.error.message);
    return { ok: true as const };
  } catch (e) { return failure(e); }
}
export async function viewAccountingAttachment(journalId: string, attachmentId: string) {
  try {
    z.string().uuid().parse(attachmentId);
    const { db } = await invoiceAccess(journalId);
    const { data: proof, error } = await db.from('tw_accounting_attachments').select('storage_path').eq('id', attachmentId).eq('journal_id', journalId).is('removed_at', null).not('uploaded_at', 'is', null).single();
    if (error || !proof) throw new Error('This attachment is unavailable or has been removed.');
    const signed = await db.storage.from('tw-accounting-attachments').createSignedUrl(proof.storage_path, 300);
    if (signed.error) throw new Error(signed.error.message);
    return { ok: true as const, url: signed.data.signedUrl };
  } catch (e) { return failure(e); }
}
export async function removeAccountingAttachment(journalId: string, attachmentId: string) {
  try {
    z.string().uuid().parse(attachmentId);
    const { db } = await invoiceAccess(journalId, true);
    // Soft removal preserves the audit record and never changes the payment.
    const result = await db.from('tw_accounting_attachments').update({ removed_at: new Date().toISOString() }).eq('id', attachmentId).eq('journal_id', journalId);
    if (result.error) throw new Error(result.error.message);
    return { ok: true as const };
  } catch (e) { return failure(e); }
}

