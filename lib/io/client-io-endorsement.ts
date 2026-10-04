import assets from "@/lib/io/client-io-endorsement-assets.json";

/** Original user-provided artwork, embedded only in authorized Client IO documents. */
export function applyClientIoEndorsement(html: string): string {
  if (html.includes('data-client-io-endorsement="1"')) return html;
  const block = `<section data-client-io-endorsement="1" aria-label="Thinkway signature and company stamp" style="break-inside:avoid;page-break-inside:avoid;margin:22px 52px 12px;padding-top:14px;border-top:1px solid #dce5f5;color:#101c3d;font-family:Arial,sans-serif">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">For Thinkway</div>
    <div style="display:flex;align-items:center;gap:12mm;flex-wrap:wrap">
      <div style="text-align:center"><img alt="Thinkway authorized signature" src="${assets.signature}" style="display:block;width:48mm;height:32mm;object-fit:contain;max-width:100%"/><div style="font-size:10px;color:#596b87;margin-top:4px">Authorized signature</div></div>
      <div style="text-align:center"><img alt="Thinkway company stamp" src="${assets.stamp}" style="display:block;width:32mm;height:32mm;object-fit:contain;max-width:100%"/><div style="font-size:10px;color:#596b87;margin-top:4px">Company stamp</div></div>
    </div>
  </section>`;
  // Both the current template and issued legacy snapshots retain their values.
  const footer = /<(?:div|footer)\b[^>]*class="(?:qfoot|doc-footer)"[^>]*>/i;
  if (footer.test(html)) return html.replace(footer, match => block + match);
  return html.replace(/<\/body>/i, block + "</body>");
}

