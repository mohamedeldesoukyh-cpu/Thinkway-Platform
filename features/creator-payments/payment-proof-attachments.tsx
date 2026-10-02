"use client";
import { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, ImageIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { completePaymentProof, listPaymentProofs, preparePaymentProof, removePaymentProof, viewPaymentProof } from './payment-proof-actions';
import { validatePaymentProof, type PaymentProof } from './payment-proof-model';

function uploadFile(url: string, file: File, progress: (value: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    xhr.open('PUT', url);
    xhr.timeout = 120000;
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => { if (e.lengthComputable) progress(Math.min(99, Math.round(e.loaded / e.total * 100))); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed. Please try again.'));
    xhr.onerror = () => reject(new Error('Connection lost. Please retry the upload.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    const body = new FormData(); body.append('cacheControl', '0'); body.append('', file);
    if (signal.aborted) { reject(new Error('Upload cancelled.')); return; }
    xhr.send(body);
  });
}

export function PaymentProofAttachments({ paymentId, canWrite }: { paymentId: string; canWrite: boolean }) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [percent, setPercent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string; type: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    void listPaymentProofs(paymentId).then(r => { if (!alive.current) return; setLoading(false); if (r.ok) setProofs(r.proofs); else setError(r.message); }).catch(() => { if (alive.current) { setLoading(false); setError('Could not load attachments. Reopen payment history to retry.'); } });
    return () => { alive.current = false; controller.current?.abort(); };
  }, [paymentId]);
  async function upload(file: File) {
    const issue = validatePaymentProof(file); if (issue) { setError(issue); return; }
    if (busy) return;
    setBusy(true); setPercent(0); setError('');
    const abort = new AbortController(); controller.current = abort;
    let id: string | null = null;
    try {
      const prepared = await preparePaymentProof(paymentId, { name: file.name, type: file.type, size: file.size });
      if (!prepared.ok) throw new Error(prepared.message);
      id = prepared.id;
      await uploadFile(prepared.url, file, value => { if (alive.current) setPercent(value); }, abort.signal);
      const complete = await completePaymentProof(paymentId, id);
      if (!complete.ok) throw new Error(complete.message);
      if (alive.current) {
        setPercent(100);
        setProofs(current => [...current, { id: prepared.id, file_name: file.name, mime_type: file.type, byte_size: file.size }]);
      }
      id = null;
    } catch (e) {
      if (id) await removePaymentProof(paymentId, id).catch(() => undefined);
      if (alive.current) setError(e instanceof Error ? e.message : 'Upload failed. Please retry.');
    } finally { if (alive.current) { setBusy(false); setPercent(null); } }
  }
  async function view(proof: PaymentProof) {
    setBusy(true); setError('');
    try { const r = await viewPaymentProof(paymentId, proof.id); if (!r.ok) throw new Error(r.message); setPreview({ name: proof.file_name, url: r.url, type: proof.mime_type }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open attachment.'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError('');
    try { const r = await removePaymentProof(paymentId, id); if (!r.ok) throw new Error(r.message); setProofs(current => current.filter(p => p.id !== id)); setRemoving(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove attachment.'); }
    finally { setBusy(false); }
  }
  return <div className="my-2 flex flex-wrap items-center gap-2" aria-label="Proof of payment">
    <span className="text-xs text-slate-500">Proof of payment</span>
    {loading && <span role="status" className="text-xs">Loading…</span>}
    {canWrite && <><input ref={input} type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }}/><button type="button" className="cp-button inline-flex h-10 w-10 items-center justify-center" title="Attach payment proof (PDF or image, up to 10 MB)" aria-label="Attach proof of payment" disabled={busy || loading} onClick={() => input.current?.click()}><Paperclip size={19}/></button></>}
    {percent !== null && <span className="relative inline-flex h-10 w-10 items-center justify-center text-[10px] font-semibold text-blue-700" role="progressbar" aria-label="Uploading payment proof" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><svg className="absolute inset-0 h-10 w-10 -rotate-90" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="#dbeafe" strokeWidth="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="3" pathLength="100" strokeDasharray={`${percent} 100`}/></svg>{percent}%</span>}
    {proofs.map(proof => <span key={proof.id} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"><button type="button" className="inline-flex max-w-48 items-center gap-2 p-1 text-sm" disabled={busy} title={`View ${proof.file_name}`} aria-label={`View ${proof.file_name}`} onClick={() => void view(proof)}>{proof.mime_type === 'application/pdf' ? <span className="flex flex-col items-center text-red-600"><FileText size={22}/><span className="text-[9px] font-bold">PDF</span></span> : <ImageIcon size={22}/>}<span className="truncate">{proof.file_name}</span></button>{canWrite && <button type="button" className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${proof.file_name}`} disabled={busy} onClick={() => setRemoving(proof.id)}><X size={15}/></button>}</span>)}
    {removing && <span className="inline-flex items-center gap-2 text-sm">Remove this attachment?<button type="button" className="cp-button" disabled={busy} onClick={() => void remove(removing)}>Remove</button><button type="button" className="cp-button" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button></span>}
    {error && <span role="alert" className="w-full text-sm text-red-700">{error}</span>}
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="max-w-4xl"><DialogTitle>{preview?.name ?? 'Payment proof'}</DialogTitle>{preview && <>{preview.type === 'application/pdf' ? <iframe title={preview.name} src={preview.url} className="h-[65dvh] w-full rounded border"/> : <img alt={preview.name} src={preview.url} className="max-h-[65dvh] w-full object-contain"/>}<a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline">Open document in a new tab</a></>}</DialogContent></Dialog>
  </div>;
}
