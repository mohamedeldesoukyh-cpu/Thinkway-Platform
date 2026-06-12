import type { InvoiceDocumentData, InvoiceLineItemRow } from "@/lib/billing/invoice-document-types";

export type InvoiceDocumentLayout = "detailed" | "package";

export function isInvoiceDocumentLayout(value: string | null | undefined): value is InvoiceDocumentLayout {
  return value === "detailed" || value === "package";
}

export function resolveInvoiceDocumentLayout(
  value: string | null | undefined
): InvoiceDocumentLayout {
  return isInvoiceDocumentLayout(value) ? value : "detailed";
}

/** Package view: one line with campaign name and invoice totals (no per-influencer rows). */
export function applyInvoiceDocumentLayout(
  data: InvoiceDocumentData,
  layout: InvoiceDocumentLayout
): InvoiceDocumentData {
  if (layout === "detailed") return data;

  const campaignLabel = data.campaign?.name?.trim() || "Campaign services";
  const campaignRef = data.campaign?.documentNumber?.trim();
  const description = campaignRef ? `${campaignLabel} (${campaignRef})` : campaignLabel;

  const subDescriptionParts = [
    data.campaign?.brandName,
    data.campaign?.startDate || data.campaign?.endDate
      ? [data.campaign?.startDate, data.campaign?.endDate].filter(Boolean).join(" – ")
      : null,
  ].filter(Boolean);

  const packageLine: InvoiceLineItemRow = {
    id: "package-summary",
    description,
    subDescription: subDescriptionParts.length > 0 ? subDescriptionParts.join(" · ") : null,
    quantity: 1,
    unitPrice: data.subtotal,
    lineTotal: data.total,
    revenueBeforeVat: data.subtotal,
    revenueVatPercent: data.vatPercent,
    revenueVatAmount: data.taxAmount,
    revenueVatExempt: data.taxAmount <= 0 && data.subtotal > 0 && data.vatPercent <= 0,
    lineDocumentNumber: data.campaign?.documentNumber ?? null,
  };

  return {
    ...data,
    lineItems: [packageLine],
  };
}
