/** Presentation only: never use this HTML as the signing snapshot. */
export function vendorIoSigningPreview(html: string): string {
  return html.replace(
    /<section class="qsec section terms-section"><div class="qh">[\s\S]*?<\/div>([\s\S]*?)<\/section>/g,
    '<details class="qsec section terms-section"><summary style="cursor:pointer;font-size:14px;font-weight:500;text-decoration:underline;padding:12px 0">Terms and conditions — tap to review</summary><p style="font-size:12px;color:#64748b;margin:8px 0">These terms form part of the IO you are signing.</p>$1</details>',
  );
}
