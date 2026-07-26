import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";
import { VENDOR_IO_DEFAULT_TERMS } from "@/lib/io/vendor-io-default-terms";

export type ClientIoTerm = {
  title: string;
  body: string;
};

/** Alias — same structured `{title, body}` shape for Client and Vendor IO terms. */
export type IoTerm = ClientIoTerm;

/** Which layer wins after resolution (for UI badges). */
export type IoTermsSource = "platform" | "entity" | "io";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeTerm(raw: unknown): ClientIoTerm | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";
  if (!title || !body) return null;
  return { title, body };
}

/** Parse JSON terms stored in text columns; returns null when empty or invalid. */
export function parseTermsText(value: string | null | undefined): ClientIoTerm[] | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return null;
    const terms = parsed.map(normalizeTerm).filter((term): term is ClientIoTerm => term != null);
    return terms.length > 0 ? terms : null;
  } catch {
    return null;
  }
}

export function serializeTermsText(terms: ClientIoTerm[]): string {
  return JSON.stringify(terms);
}

export function resolveEffectiveTerms(
  platformDefault: ClientIoTerm[],
  clientTerms: ClientIoTerm[] | null,
  cioTerms: ClientIoTerm[] | null
): ClientIoTerm[] {
  if (cioTerms && cioTerms.length > 0) return cioTerms;
  if (clientTerms && clientTerms.length > 0) return clientTerms;
  return platformDefault;
}

export function resolveDefaultTermsForClient(
  clientTermsText: string | null | undefined
): ClientIoTerm[] {
  return resolveEffectiveTerms(
    CLIENT_IO_DEFAULT_TERMS,
    parseTermsText(clientTermsText),
    null
  );
}

/** Vendor defaults only (no per-IO override). */
export function resolveDefaultTermsForVendor(
  vendorTermsText: string | null | undefined
): ClientIoTerm[] {
  return resolveEffectiveTerms(
    VENDOR_IO_DEFAULT_TERMS,
    parseTermsText(vendorTermsText),
    null
  );
}

/** Full Vendor IO hierarchy: IO → vendor → platform. */
export function resolveEffectiveVendorIoTerms(
  vendorTermsText: string | null | undefined,
  ioTermsText: string | null | undefined
): ClientIoTerm[] {
  return resolveEffectiveTerms(
    VENDOR_IO_DEFAULT_TERMS,
    parseTermsText(vendorTermsText),
    parseTermsText(ioTermsText)
  );
}

export function resolveIoTermsSource(
  entityTerms: ClientIoTerm[] | null,
  ioTerms: ClientIoTerm[] | null
): IoTermsSource {
  if (ioTerms && ioTerms.length > 0) return "io";
  if (entityTerms && entityTerms.length > 0) return "entity";
  return "platform";
}

/** Normalize form/DB payload — empty/invalid → null (inherit parent layer). */
export function normalizeIoTermsText(
  value: string | null | undefined
): string | null {
  const parsed = parseTermsText(value);
  return parsed ? serializeTermsText(parsed) : null;
}

export function termsAreEqual(a: ClientIoTerm[], b: ClientIoTerm[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (term, index) => term.title === b[index]?.title && term.body === b[index]?.body
  );
}

export function renderTermsListHtml(terms: ClientIoTerm[]): string {
  return terms
    .map(
      (term, index) => `
        <li>
          <span class="tnum">${index + 1}</span>
          <span><strong>${escapeHtml(term.title)}</strong> ${escapeHtml(term.body)}</span>
        </li>`
    )
    .join("");
}
