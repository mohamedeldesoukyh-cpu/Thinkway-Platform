import { z } from "zod";

export const SIGNATURE_CONSENT = "By signing, I agree to this IO and its terms.";
const point = z.tuple([z.number().finite().min(0).max(1), z.number().finite().min(0).max(1)]);
export const signatureSchema = z.array(z.array(point).min(2).max(1500)).min(1).max(30)
  .refine(strokes => strokes.reduce((sum, stroke) => sum + stroke.length, 0) <= 6000, "Signature is too large.")
  .refine(strokes => strokes.reduce((sum, stroke) => sum + stroke.slice(1).reduce((distance, p, i) =>
    distance + Math.hypot(p[0] - stroke[i][0], p[1] - stroke[i][1]), 0), 0) >= 0.06, "Please draw your signature.");
export type SignatureStrokes = z.infer<typeof signatureSchema>;
export const signingInputSchema = z.object({
  token: z.string().max(256).optional(),
  ioId: z.string().uuid().optional(),
  documentHash: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(2, "Enter your full name.").max(160),
  strokes: signatureSchema,
}).refine(value => Boolean(value.token) !== Boolean(value.ioId), "Invalid signing link.");

function escape(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Only validated numeric points are allowed into SVG; never accept user-provided markup. */
export function signatureSvg(strokes: SignatureStrokes): string {
  const valid = signatureSchema.parse(strokes);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200"><g fill="none" stroke="#14213d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${valid.map(stroke => `<polyline points="${stroke.map(([x, y]) => `${(x * 600).toFixed(2)},${(y * 200).toFixed(2)}`).join(" ")}"/>`).join("")}</g></svg>`;
}

export function signedVendorIoHtml(input: {
  html: string; name: string; signedAt: string; documentHash: string; signatureDataUrl: string;
}): string {
  if (!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(input.signatureDataUrl)) throw new Error("Invalid signature image.");
  if (!/^[a-f0-9]{64}$/.test(input.documentHash)) throw new Error("Invalid document hash.");
  const date = new Date(input.signedAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid signing date.");
  const block = `<section data-io-signature="signed" style="break-inside:avoid;page-break-inside:avoid;border:2px solid #047857;border-radius:12px;padding:24px;margin:24px auto;max-width:940px;background:#fff;font-family:Arial,sans-serif;color:#14213d"><h2 style="font-size:22px;margin:0 0 12px">Signed &amp; Approved</h2><img alt="Creator signature" src="${input.signatureDataUrl}" style="width:300px;max-width:100%;height:100px;object-fit:contain;object-position:left"/><p><strong>${escape(input.name)}</strong><br>${escape(date.toISOString())}</p><p>${SIGNATURE_CONSENT}</p><p style="font-size:10px;overflow-wrap:anywhere;color:#64748b">Document SHA-256: ${input.documentHash}</p></section>`;
  return /<\/body>/i.test(input.html) ? input.html.replace(/<\/body>/i, `${block}</body>`) : input.html + block;
}
