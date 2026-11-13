"use client";

import { useRef, useState, useTransition, type PointerEvent } from "react";
import { signVendorIoAction } from "../sign-vendor-io-action";
import { SIGNATURE_CONSENT, signatureSchema, type SignatureStrokes } from "@/lib/io/vendor-io-signature";

export function VendorIoSigningForm({ token, ioId, documentHash }: { token?: string; ioId?: string; documentHash: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<SignatureStrokes>([]);
  const active = useRef<number | null>(null);
  const [name, setName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; downloadUrl?: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  function point(event: PointerEvent<HTMLCanvasElement>): [number, number] {
    const box = event.currentTarget.getBoundingClientRect();
    return [Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))];
  }
  function finish(event: PointerEvent<HTMLCanvasElement>) {
    if (active.current !== event.pointerId) return;
    active.current = null;
    if (strokes.current.at(-1)?.length === 1) strokes.current.pop();
    setHasSignature(signatureSchema.safeParse(strokes.current).success);
  }
  if (result?.ok) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950" role="status">
    <h2 className="text-xl font-semibold">Signed &amp; approved</h2><p className="mt-2">{result.message}</p>
    {result.downloadUrl && <a className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-emerald-800 px-5 font-semibold text-white" href={result.downloadUrl}>Download signed PDF</a>}
  </section>;
  return <form className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" onSubmit={event => {
    event.preventDefault(); if (pending) return; setResult(null);
    startTransition(async () => {
      try { setResult(await signVendorIoAction({ token, ioId, documentHash, name, strokes: strokes.current })); }
      catch { setResult({ ok: false, message: "Connection interrupted. Your signature is still here; please try again." }); }
    });
  }}>
    <h2 className="text-xl font-semibold text-slate-950">Your signature</h2>
    <div><label htmlFor="signer-name" className="mb-2 block text-sm font-medium text-slate-800">Full name</label>
      <input id="signer-name" name="name" autoComplete="name" required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} disabled={pending}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Enter your full name" /></div>
    <div>
      <div className="mb-2 flex items-center justify-between"><label htmlFor="creator-signature" className="text-sm font-medium text-slate-800">Draw your signature</label>
        <button type="button" disabled={pending} className="min-h-10 px-2 text-sm font-medium text-blue-700 disabled:opacity-50" onClick={() => {
          canvas.current?.getContext("2d")?.clearRect(0,0,600,200); strokes.current=[]; active.current=null; setHasSignature(false);
        }}>Clear</button></div>
      <canvas id="creator-signature" ref={canvas} width={600} height={200} role="img" aria-label="Signature pad. Draw with your finger, mouse or stylus." aria-describedby="signature-help"
        className="block aspect-[3/1] w-full touch-none rounded-xl border border-slate-300 bg-slate-50" style={{ cursor: pending ? "wait" : "crosshair" }}
        onPointerDown={event => {
          if (pending || active.current !== null || strokes.current.length >= 30) return;
          active.current=event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); strokes.current.push([point(event)]);
        }}
        onPointerMove={event => {
          if (active.current !== event.pointerId || pending) return;
          const stroke=strokes.current.at(-1)!;
          if(stroke.length>=1500 || strokes.current.reduce((sum,s)=>sum+s.length,0)>=6000) return;
          const next=point(event), previous=stroke.at(-1)!;
          const ctx=event.currentTarget.getContext("2d");
          if(ctx){ctx.strokeStyle="#14213d";ctx.lineWidth=2.5;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(previous[0]*600,previous[1]*200);ctx.lineTo(next[0]*600,next[1]*200);ctx.stroke();}
          stroke.push(next);
        }} onPointerUp={finish} onPointerCancel={finish} />
      <p id="signature-help" className="mt-2 text-sm text-slate-500">Use your finger or mouse to sign inside the box.</p>
    </div>
    <p className="text-sm leading-relaxed text-slate-600">{SIGNATURE_CONSENT}</p>
    {result && !result.ok && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{result.message}</p>}
    <button type="submit" disabled={pending || name.trim().length<2 || !hasSignature}
      className="flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
      {pending ? "Saving your signed IO…" : "Sign & Approve"}
    </button><p className="text-center text-xs text-slate-500">A signed PDF will be emailed to you.</p>
  </form>;
}
