/** Keep the HTML's own 52px content gutter; do not add a second side margin. */
export const CLIENT_IO_PRINT_STYLES = `
@page{size:A4;margin:14mm 0}
@media print{
  body{padding:0;background:#fff}
  .paper{width:100%;max-width:none;margin:0;box-shadow:none;border-radius:0}
}
`.trim();

export function isClassicClientIoHtml(html: string | null | undefined): html is string {
  return Boolean(html && /Client Insertion Order/i.test(html) && /class="paper"/.test(html) && /class="doc"/.test(html));
}

/** Presentation-only repair of saved snapshots; never substitute live campaign values. */
export function applyClientIoPrintLayout(html: string): string {
  if (!isClassicClientIoHtml(html) || html.includes('data-client-io-print="2"')) return html;
  return html.replace(/<\/head>/i, `<style data-client-io-print="2">${CLIENT_IO_PRINT_STYLES}</style></head>`);
}
