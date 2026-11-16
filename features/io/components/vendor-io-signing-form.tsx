"use client";

import { useRef, useState, useTransition, type PointerEvent } from "react";
import { signVendorIoAction } from "../sign-vendor-io-action";
import { SIGNATURE_CONSENT, signatureSchema, typedSignatureSvg, type SignatureStrokes } from "@/lib/io/vendor-io-signature";

export function VendorIoSigningForm({ token, ioId, documentHash }: { token?: string; ioId?: string; documentHash: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<SignatureStrokes>([]);
  const active = useRef<number | null>(null);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<"draw" | "type">("draw");
  const [agreed, setAgreed] = useState(false);
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
    event.preventDefault(); if (pending || !agreed) return; setResult(null);
    startTransition(async () => {
      try { setResult(await signVendorIoAction({ token, ioId, documentHash, name, method, consent: agreed, ...(method === "draw" ? { strokes: strokes.current } : {}) })); }
      catch { setResult({ ok: false, message: "Connection interrupted. Your signature is still here; please try again." }); }
    });
  }}>
    <h2 className="text-xl font-semibold text-slate-950">Your signature</h2>
    <div><label htmlFor="signer-name" className="mb-2 block text-sm font-medium text-slate-800">Full name</label>
      <input id="signer-name" name="name" autoComplete="name" required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} disabled={pending}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" placeholder="Enter your full name" /></div>
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Signature method">
      {(["draw", "type"] as const).map(option => <button key={option} type="button" aria-pressed={method === option} disabled={pending}
        onClick={() => { setMethod(option); setResult(null); }}
        className={`min-h-12 rounded-lg border px-3 text-sm font-medium ${method === option ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-700"}`}>
        {option === "draw" ? "Draw signature" : "Type signature"}
      </button>)}
    </div>
    <div hidden={method !== "draw"}>
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
    {method === "type" && <div>
      <p className="mb-2 text-sm font-medium text-slate-800">Your typed signature</p>
      <div className="flex aspect-[3/1] items-center justify-center rounded-xl border border-slate-300 bg-slate-50" aria-live="polite">
        {name.trim().length >= 2 ? <img alt={`Signature preview: ${name.trim()}`} className="h-full w-full" src={`data:image/svg+xml,${encodeURIComponent(typedSignatureSvg(name))}`} />
          : <p className="px-4 text-center text-sm text-slate-500">Enter your full name above to create your signature.</p>}
      </div>
      <p className="mt-2 text-sm text-slate-500">Your name above becomes your signature. Review it before approving.</p>
    </div>}
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm leading-relaxed text-slate-700">
      <input type="checkbox" required checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={pending} className="mt-1 size-5 shrink-0 accent-blue-600" />
      <span>I have reviewed the IO and its Terms and conditions. {SIGNATURE_CONSENT}</span>
    </label>
    {result && !result.ok && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{result.message}</p>}
    <button type="submit" disabled={pending || !agreed || name.trim().length<2 || (method === "draw" && !hasSignature)}
      className="flex min-h-14 w-full items-center justify-center rounded-xl bg-blue-600 px-5 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
      {pending ? "Saving your signed IO…" : "Sign & Approve"}
    </button><p className="text-center text-xs text-slate-500">A signed PDF will be emailed to you.</p>
  </form>;
}
