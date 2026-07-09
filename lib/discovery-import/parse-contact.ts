import { lookupCell } from "@/lib/intelligence/parsers/header-normalize";
import {
  extractEmailFromText,
  normalizeContactEmail,
  normalizeContactLinks,
  normalizeContactPhone,
} from "@/lib/creators/contact-info";

import type { ParsedCreatorRow } from "./types";

export function parseImportContactFromLookup(
  lookup: Map<string, unknown>
): Pick<ParsedCreatorRow, "contact_email" | "contact_phone" | "contact_links"> {
  const emailRaw = lookupCell(
    lookup,
    "email",
    "contact email",
    "contact_email",
    "business email",
    "business_email",
    "e-mail",
    "mail"
  );
  const phoneRaw = lookupCell(
    lookup,
    "phone",
    "contact phone",
    "contact_phone",
    "telephone",
    "mobile",
    "cell"
  );
  const websiteRaw = lookupCell(
    lookup,
    "website",
    "url",
    "link",
    "external url",
    "external_url",
    "contact link",
    "contact_link",
    "bio link",
    "bio_link"
  );
  const bioText = lookupCell(lookup, "bio", "biography", "description", "about");

  const contact_email =
    normalizeContactEmail(emailRaw) ?? extractEmailFromText(bioText);
  const contact_phone = normalizeContactPhone(phoneRaw);
  const contact_links = normalizeContactLinks(websiteRaw ? [websiteRaw] : []);

  return { contact_email, contact_phone, contact_links };
}
