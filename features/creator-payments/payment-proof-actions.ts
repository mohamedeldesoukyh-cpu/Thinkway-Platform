"use server";
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRequestUser } from '@/lib/supabase/server';
import { PAYMENT_PROOF_BUCKET, validatePaymentProof, type PaymentProof } from './payment-proof-model';

async function paymentAccess(paymentId: string, write = false) {
  z.string().uuid().parse(paymentId);
  const { supabase } = await requireRequestUser();
  const db = supabase as SupabaseClient;
  const { data: payment, error } = await db.from('creator_payment_entries').select('id,campaign_id,status').eq('id', paymentId).single();
  if (error || !payment) throw new Error('Payment is unavailable.');
  const permission = await db.rpc('can_manage_creator_payments', { p_campaign: payment.campaign_id, p_write: write });
  if (permission.error || !permission.data) throw new Error('Finance access is required.');
  return { db, payment };
}
const failure = (e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : 'Could not update payment proof.' });
export async function listPaymentProofs(paymentId: string) {
  try {
    const { db } = await paymentAccess(paymentId);
    const { data, error } = await db.from('creator_payment_proofs').select('id,file_name,mime_type,byte_size').eq('payment_id', paymentId).is('removed_at', null).not('uploaded_at', 'is', null).order('created_at');
    if (error) throw new Error(error.message);
    return { ok: true as const, proofs: (data ?? []) as PaymentProof[] };
  } catch (e) { return failure(e); }
}
export async function preparePaymentProof(paymentId: string, file: { name: string; type: string; size: number }) {
  try {
    const input = z.object({ name: z.string(), type: z.string(), size: z.number().int() }).parse(file);
    const issue = validatePaymentProof(input); if (issue) throw new Error(issue);
    const { db, payment } = await paymentAccess(paymentId, true);
    if (payment.status !== 'paid') throw new Error('Record or confirm the payment before attaching proof.');
    const id = randomUUID();
    const extension = input.type === 'application/pdf' ? 'pdf' : input.type.split('/')[1];
    const storagePath = `${paymentId}/${id}.${extension}`;
    const saved = await db.from('creator_payment_proofs').insert({ id, payment_id: paymentId, file_name: input.name, mime_type: input.type, byte_size: input.size, storage_path: storagePath });
    if (saved.error) throw new Error(saved.error.message);
    const signed = await db.storage.from(PAYMENT_PROOF_BUCKET).createSignedUploadUrl(storagePath);
    if (signed.error) {
      await db.from('creator_payment_proofs').update({ removed_at: new Date().toISOString() }).eq('id', id);
      throw new Error(signed.error.message);
    }
    return { ok: true as const, id, url: signed.data.signedUrl };
  } catch (e) { return failure(e); }
}
export async function completePaymentProof(paymentId: string, proofId: string) {
  try {
    z.string().uuid().parse(proofId);
    const { db } = await paymentAccess(paymentId, true);
    const { data: proof, error } = await db.from('creator_payment_proofs').select('storage_path,byte_size,mime_type').eq('id', proofId).eq('payment_id', paymentId).is('removed_at', null).single();
    if (error || !proof) throw new Error('Upload is unavailable. Please retry.');
    const leaf = proof.storage_path.split('/').pop();
    const objects = await db.storage.from(PAYMENT_PROOF_BUCKET).list(paymentId, { search: leaf });
    const object = objects.data?.find(o => o.name === leaf);
    if (objects.error || !object || Number(object.metadata?.size) !== proof.byte_size || object.metadata?.mimetype !== proof.mime_type) throw new Error('The upload is incomplete. Please retry.');
    const saved = await db.from('creator_payment_proofs').update({ uploaded_at: new Date().toISOString() }).eq('id', proofId).eq('payment_id', paymentId).is('removed_at', null);
    if (saved.error) throw new Error(saved.error.message);
    return { ok: true as const };
  } catch (e) { return failure(e); }
}
export async function viewPaymentProof(paymentId: string, proofId: string) {
  try {
    z.string().uuid().parse(proofId);
    const { db } = await paymentAccess(paymentId);
    const { data: proof, error } = await db.from('creator_payment_proofs').select('storage_path').eq('id', proofId).eq('payment_id', paymentId).is('removed_at', null).not('uploaded_at', 'is', null).single();
    if (error || !proof) throw new Error('This attachment is unavailable or has been removed.');
    const signed = await db.storage.from(PAYMENT_PROOF_BUCKET).createSignedUrl(proof.storage_path, 60);
    if (signed.error) throw new Error(signed.error.message);
    return { ok: true as const, url: signed.data.signedUrl };
  } catch (e) { return failure(e); }
}
export async function removePaymentProof(paymentId: string, proofId: string) {
  try {
    z.string().uuid().parse(proofId);
    const { db } = await paymentAccess(paymentId, true);
    // Soft removal preserves the audit record and never changes the payment.
    const result = await db.from('creator_payment_proofs').update({ removed_at: new Date().toISOString() }).eq('id', proofId).eq('payment_id', paymentId);
    if (result.error) throw new Error(result.error.message);
    return { ok: true as const };
  } catch (e) { return failure(e); }
}
