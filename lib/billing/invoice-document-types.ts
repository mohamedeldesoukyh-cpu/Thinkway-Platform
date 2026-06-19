export type InvoiceLineItemRow = {
  id: string;
  description: string;
  subDescription: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  revenueBeforeVat: number;
  revenueVatPercent: number;
  revenueVatAmount: number;
  revenueVatExempt: boolean;
  lineDocumentNumber: string | null;
};

export type InvoiceCommercialBreakdown = {
  revenueAmount: number;
  agencyFeeAmount: number;
};

export type InvoiceDocumentData = {
  invoiceId: string;
  documentNumber: string;
  issueDate: string;
  dueDate: string | null;
  currencyCode: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  vatPercent: number;
  notes: string | null;
  usdEquivalent: number | null;
  client: {
    id: string;
    name: string;
    legalName: string | null;
    documentNumber: string;
    billingName: string;
    addressLine1: string | null;
    addressLine2: string | null;
    cityCountry: string | null;
    vatNumber: string | null;
    taxId: string | null;
    paymentTerms: string | null;
  };
  campaign: {
    id: string;
    documentNumber: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    brandName: string | null;
    poNumber: string | null;
    clientBoNumber: string | null;
    clientIoReferences: string[];
    clientIoReferenceDisplay: string;
    poReferenceDisplay: string;
    clientBoReferenceDisplay: string;
    internalReference: string | null;
  } | null;
  commercialBreakdown: InvoiceCommercialBreakdown;
  lineItems: InvoiceLineItemRow[];
};
