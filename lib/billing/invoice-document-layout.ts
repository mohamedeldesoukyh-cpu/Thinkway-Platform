import type {
  InvoiceDocumentData,
  InvoiceLineItemRow,
} from "@/lib/billing/invoice-document-types";
import { computeVatLine } from "@/lib/vat/calculations";

export type InvoiceDocumentLayout = "detailed" | "package";

export function isInvoiceDocumentLayout(value: string | null | undefined): value is InvoiceDocumentLayout {
  return value === "detailed" || value === "package";
}

export function resolveInvoiceDocumentLayout(
  value: string | null | undefined
): InvoiceDocumentLayout {
  return isInvoiceDocumentLayout(value) ? value : "detailed";
}

function buildPackageSubDescription(data: InvoiceDocumentData): string | null {
  const parts = [
    data.campaign?.brandName,
    data.campaign?.startDate || data.campaign?.endDate
      ? [data.campaign?.startDate, data.campaign?.endDate].filter(Boolean).join(" – ")
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildPackageLineItem(input: {
  id: string;
  description: string;
  subDescription: string | null;
  revenueBeforeVat: number;
  vatPercent: number;
  vatExempt: boolean;
}): InvoiceLineItemRow {
  const vat = computeVatLine({
    beforeVat: input.revenueBeforeVat,
    vatPercent: input.vatExempt ? 0 : input.vatPercent,
    exempt: input.vatExempt,
  });

  return {
    id: input.id,
    description: input.description,
    subDescription: input.subDescription,
    quantity: 1,
    unitPrice: input.revenueBeforeVat,
    revenueBeforeVat: input.revenueBeforeVat,
    revenueVatPercent: vat.vatPercent,
    revenueVatAmount: vat.vatAmount,
    revenueVatExempt: input.vatExempt,
    lineTotal: vat.afterVat,
    lineDocumentNumber: null,
  };
}

/** Package view: campaign summary with revenue and agency fees on separate lines. */
export function applyInvoiceDocumentLayout(
  data: InvoiceDocumentData,
  layout: InvoiceDocumentLayout
): InvoiceDocumentData {
  if (layout === "detailed") return data;

  const campaignLabel = data.campaign?.name?.trim() || "Campaign services";
  const subDescription = buildPackageSubDescription(data);
  const vatExempt = data.taxAmount <= 0 && data.subtotal > 0 && data.vatPercent <= 0;
  const { revenueAmount, agencyFeeAmount } = data.commercialBreakdown;

  const packageLines: InvoiceLineItemRow[] = [];

  if (revenueAmount > 0) {
    packageLines.push(
      buildPackageLineItem({
        id: "package-revenue",
        description: campaignLabel,
        subDescription,
        revenueBeforeVat: revenueAmount,
        vatPercent: data.vatPercent,
        vatExempt,
      })
    );
  }

  if (agencyFeeAmount > 0) {
    packageLines.push(
      buildPackageLineItem({
        id: "package-agency-fee",
        description: "Agency fees",
        subDescription: null,
        revenueBeforeVat: agencyFeeAmount,
        vatPercent: data.vatPercent,
        vatExempt,
      })
    );
  }

  if (packageLines.length === 0) {
    packageLines.push(
      buildPackageLineItem({
        id: "package-summary",
        description: campaignLabel,
        subDescription,
        revenueBeforeVat: data.subtotal,
        vatPercent: data.vatPercent,
        vatExempt,
      })
    );
  }

  return {
    ...data,
    lineItems: packageLines,
  };
}
