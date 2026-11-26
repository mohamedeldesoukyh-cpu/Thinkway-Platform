type CreatorRegistrationSource = {
  metadata?: Record<string, unknown> | null;
  city?: string | null;
  country_code?: string | null;
  tax_registration_number?: string | null;
  management_agency?: string | null;
};

/** Shared mapping for current creator cards and newly prepared IOs. */
export function creatorRegistration(source: CreatorRegistrationSource) {
  const meta = source.metadata ?? {};
  const text = (key: string) => typeof meta[key] === 'string' ? (meta[key] as string).trim() || null : null;
  const documentType = text('legal_document_type');
  const documentLabel = documentType === 'national_id' ? 'ID' : documentType === 'trade_license' ? 'Trade License / CR' : 'ID / Trade License';
  const documentNumber = documentType === 'national_id'
    ? text('national_id_number') ?? text('national_id')
    : documentType === 'trade_license' ? text('trade_license')
    : text('national_id_number') ?? text('national_id') ?? text('trade_license');
  const address = [text('legal_address_line1') ?? text('address'), text('legal_address_line2'), text('legal_address_city') ?? source.city, text('legal_address_country') ?? source.country_code, text('legal_address_postal_code')].filter(Boolean).join(', ') || null;
  const agencyEnabled = typeof meta.has_management_agency === 'boolean' ? meta.has_management_agency : Boolean(text('agency_name') || source.management_agency);
  return {
    documentLabel, documentNumber, address,
    documentExpiry: text('legal_document_expiry'),
    taxId: source.tax_registration_number !== undefined ? source.tax_registration_number : text('tax_id'),
    vatNumber: text('vat_number'),
    agency: agencyEnabled ? {
      name: text('agency_name'), contact: text('agency_contact_name') ?? source.management_agency ?? null,
      email: text('agency_email'), phone: text('agency_phone'), address: text('agency_address'),
      registrationNumber: text('agency_registration_number'), taxNumber: text('agency_tax_number'),
    } : null,
  };
}

export type CreatorRegistration = ReturnType<typeof creatorRegistration>;
