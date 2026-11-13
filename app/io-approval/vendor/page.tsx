import type { Metadata } from "next";
import { loadVendorSigningSession } from "@/lib/io/vendor-io-signing-session";
import { createIoDocumentSignedUrl } from "@/lib/io/io-document-storage";
import { VendorIoSigningForm } from "@/features/io/components/vendor-io-signing-form";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = { title: "Review & Sign your IO | Thinkway", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function VendorIoApprovalPage({ searchParams }: { searchParams: Promise<{ token?: string; io?: string }> }) {
  const params = await searchParams;
  let session;
  try { session = await loadVendorSigningSession({ token: params.token, ioId: params.token ? undefined : params.io }); }
  catch (error) {
    const message=error instanceof Error ? error.message : "";
    const explanation=message.includes("SUPERSEDED") ? "A newer IO has been issued. Please use the latest email from Thinkway."
      : message.includes("EXPIRED") ? "This link has expired. Please ask Thinkway for a new signing link."
      : message.includes("IO has changed") ? message : "This IO is not available to sign. Please use the link in your email or contact Thinkway.";
    return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-semibold">Signing link unavailable</h1><p className="mt-3 text-muted-foreground">{explanation}</p></main>;
  }
  const { io, signature }=session;
  const campaign=Array.isArray(io.campaign) ? io.campaign[0] : io.campaign;
  const downloadUrl=signature ? await createIoDocumentSignedUrl(session.db,"vendor-io-documents",signature.signed_pdf_path) : null;
  const html=signature?.signed_html ?? io.terms_html ?? "";
  // Presentation-only responsive styles; signing preserves the untouched document snapshot.
  const responsive="<style>@media screen and (max-width:640px){.paper{width:100%!important;min-width:0!important;margin:0!important}.doc{padding:8px!important}.qgrid2,.sig-grid{grid-template-columns:1fr!important}.qsec{padding:14px!important}.hero{padding:18px!important}body{min-width:0!important;margin:0!important}}</style>";
  return <main className="min-h-screen bg-slate-50 px-4 py-7 text-slate-900 sm:px-6 sm:py-10">
    <div className="mx-auto max-w-4xl space-y-6">
      <header><p className="text-sm font-bold tracking-wide text-blue-700">THINKWAY MEDIA</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{session.alreadyApproved ? "Your approved IO" : "Review & sign your IO"}</h1>
        <p className="mt-2 text-slate-600">{io.document_number} · {campaign?.name ?? "Creator Insertion Order"}</p>
        {!session.alreadyApproved && <p className="mt-2 text-sm text-slate-500">Review the document below, then add your name and signature.</p>}</header>
      <iframe title="Your Creator Insertion Order" sandbox="" referrerPolicy="no-referrer"
        srcDoc={html.replace(/<\/head>/i,`${responsive}</head>`)} className="h-[65vh] min-h-[400px] w-full rounded-2xl border border-slate-200 bg-white" />
      {session.alreadyApproved ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h2 className="text-xl font-semibold">{signature ? "Signed & approved" : "Already approved"}</h2>
        <p className="mt-2">{signature ? `Thank you, ${signature.signer_name}. Your signature has been saved.` : "This IO was previously approved. No further action is needed."}</p>
        {downloadUrl && <a href={downloadUrl} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-emerald-800 px-5 font-semibold text-white">Download signed PDF</a>}
      </section> : <VendorIoSigningForm token={session.token} ioId={session.token ? undefined : io.id} documentHash={session.documentHash!} />}
    </div>
  </main>;
}
