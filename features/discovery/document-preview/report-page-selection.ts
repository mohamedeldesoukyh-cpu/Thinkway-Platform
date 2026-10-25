/** Page selection for generated creator reports. Indices are one-based in the original report. */
export function reportPages(html: string): string[] {
  return html.match(/<section class="page[^"]*">[\s\S]*?<\/section>/g) ?? [];
}

export function omitReportPages(html: string, excluded: readonly number[]): string {
  if (!excluded.length) return html;
  const pages = reportPages(html);
  const hidden = new Set(excluded);
  const count = pages.filter((_, index) => !hidden.has(index + 1)).length;
  if (!count) return html; // A report must retain at least one page.
  let original = 0;
  let visible = 0;
  return html.replace(/<section class="page[^"]*">[\s\S]*?<\/section>/g, page => {
    if (hidden.has(++original)) return "";
    ++visible;
    return page.replace(/(<footer>[\s\S]*<span>)[^<]*(<\/span><\/footer>)/, `$1${visible} / ${count}$2`);
  });
}
