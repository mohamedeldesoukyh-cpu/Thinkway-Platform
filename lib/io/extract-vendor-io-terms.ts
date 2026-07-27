import type { ClientIoTerm } from "@/lib/io/client-io-terms";

/**
 * Extract Section 8 legal terms from a Vendor IO HTML document.
 * Ignores CSS / styling — titles, order, and body text only.
 */
export function extractTermsFromVendorIoHtml(html: string): ClientIoTerm[] {
  const listMatch = html.match(/<ul class="terms-list">([\s\S]*?)<\/ul>/i);
  if (!listMatch?.[1]) return [];

  const items = [...listMatch[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)];
  const terms: ClientIoTerm[] = [];

  for (const item of items) {
    const block = item[1] ?? "";
    const titleMatch = block.match(/<strong>([\s\S]*?)<\/strong>/i);
    if (!titleMatch?.[1]) continue;
    const title = decodeBasicHtmlEntities(stripTags(titleMatch[1]).trim());
    const afterStrong = block.slice(block.indexOf(titleMatch[0]) + titleMatch[0].length);
    const body = decodeBasicHtmlEntities(stripTags(afterStrong).trim());
    if (!title || !body) continue;
    terms.push({ title, body });
  }

  return terms;
}

/** Normalize PDF/plain text for legal-term comparison (whitespace collapsed). */
export function normalizeLegalText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Assert every structured term appears in PDF plain text in order.
 * Numbering may render as "1" adjacent to title depending on PDF layout.
 */
export function pdfContainsTermsInOrder(pdfText: string, terms: ClientIoTerm[]): boolean {
  const haystack = normalizeLegalText(pdfText);
  let cursor = 0;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i]!;
    const title = normalizeLegalText(term.title);
    const body = normalizeLegalText(term.body);
    const titleAt = haystack.indexOf(title, cursor);
    if (titleAt < 0) return false;
    const bodyAt = haystack.indexOf(body, titleAt + title.length);
    if (bodyAt < 0) return false;
    cursor = bodyAt + body.length;
  }
  return true;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
