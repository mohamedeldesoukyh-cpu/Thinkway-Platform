import type { ClientIoTerm } from "./client-io-terms";
import { VENDOR_IO_COMPLIANCE_CLAUSES } from "./vendor-io-default-terms";

export type VendorIoComplianceCountry = "AE" | "EG";

export function normalizeVendorIoCountry(value: string | null | undefined): VendorIoComplianceCountry | null {
  const country = value?.trim().toUpperCase();
  if (["AE", "ARE", "UAE", "UNITED ARAB EMIRATES"].includes(country ?? "")) return "AE";
  if (["EG", "EGY", "EGYPT", "ARAB REPUBLIC OF EGYPT"].includes(country ?? "")) return "EG";
  return null;
}

export function resolveVendorIoCountry(override?: string | null, creatorCountry?: string | null): VendorIoComplianceCountry {
  return normalizeVendorIoCountry(override) ?? normalizeVendorIoCountry(creatorCountry) ?? "EG";
}

export function vendorIoCountryLabel(country: VendorIoComplianceCountry): string {
  return country === "AE" ? "United Arab Emirates" : "Egypt";
}

/** Country selection controls only the local-compliance clause, never governing law. */
export function applyVendorIoComplianceCountry(terms: ClientIoTerm[], country: VendorIoComplianceCountry): ClientIoTerm[] {
  const clause = {
    title: "Compliance with Local Laws & Ethical Behavior.",
    body: VENDOR_IO_COMPLIANCE_CLAUSES[country],
  };
  const index = terms.findIndex(term => term.title.startsWith("Compliance with Local Laws"));
  if (index < 0) return [...terms, clause];
  return terms.map((term, i) => i === index ? clause : term);
}
