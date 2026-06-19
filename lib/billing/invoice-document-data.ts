import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeAgencyFeeAmount,
} from "@/lib/assignments/client-billing-commercial";
import type {
  InvoiceCommercialBreakdown,
  InvoiceDocumentData,
  InvoiceLineItemRow,
} from "@/lib/billing/invoice-document-types";
import { getInvoiceLines } from "@/lib/finance/invoice-line-registry";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import { REL } from "@/lib/supabase/relation-hints";
import { roundMoney } from "@/lib/vat/calculations";

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function readAddressField(address: Record<string, unknown>, key: string): string | null {
  const value = address[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatClientAddress(input: {
  legalAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  city: string | null;
  country: string | null;
}): { line1: string | null; line2: string | null; cityCountry: string | null } {
  const legal = input.legalAddress ?? {};
  const billing = input.billingAddress ?? {};

  const line1 =
    readAddressField(legal, "line1") ??
    readAddressField(billing, "line1") ??
    readAddressField(billing, "street");
  const line2 =
    readAddressField(legal, "line2") ??
    readAddressField(billing, "line2") ??
    readAddressField(billing, "street2");

  const city =
    readAddressField(legal, "city") ??
    readAddressField(billing, "city") ??
    input.city;
  const country =
    readAddressField(legal, "country") ??
    readAddressField(billing, "country") ??
    input.country;

  const cityCountry = [city, country].filter(Boolean).join(", ") || null;

  return { line1, line2, cityCountry };
}

function formatPaymentTermsLabel(value: string | null): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    net_30: "Net 30 Days",
    net_15: "Net 15 Days",
    net_45: "Net 45 Days",
    net_60: "Net 60 Days",
    due_on_receipt: "Due on Receipt",
  };
  return map[normalized] ?? value.replace(/_/g, " ");
}

function resolveVatPercent(lines: InvoiceLineItemRow[], fallback: number): number {
  const taxable = lines.filter((line) => !line.revenueVatExempt && line.revenueVatPercent > 0);
  if (taxable.length === 0) return fallback;
  return taxable[0]!.revenueVatPercent;
}

function buildLineSubDescription(input: {
  deliverableLabel: string | null;
  lineDocumentNumber: string | null;
  campaignName: string | null;
}): string | null {
  const parts = [
    input.deliverableLabel,
    input.lineDocumentNumber ? `Line ${input.lineDocumentNumber}` : null,
    input.campaignName,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function resolveClientIoReferenceDisplay(references: string[]): string {
  if (references.length === 0) return "—";
  return references.join(", ");
}

function resolvePoReferenceDisplay(poNumber: string | null): string {
  return poNumber?.trim() || "—";
}

function resolveClientBoReferenceDisplay(clientBoNumber: string | null): string {
  return clientBoNumber?.trim() || "—";
}

type CampaignLineCommercial = {
  revenueBeforeVat: number;
  usageRightsAmount: number;
  agencyFeeAmount: number;
  taxableBase: number;
};

function resolveCampaignLineCommercial(line: {
  revenue?: number | null;
  revenue_before_vat?: number | null;
  usage_rights_amount?: number | null;
  agency_fee_amount?: number | null;
  agency_fee_percent?: number | null;
}): CampaignLineCommercial {
  const revenueBeforeVat = roundMoney(
    Math.max(0, Number(line.revenue_before_vat ?? line.revenue ?? 0))
  );
  const usageRightsAmount = roundMoney(Math.max(0, Number(line.usage_rights_amount ?? 0)));
  const agencyFeeAmount =
    line.agency_fee_amount != null && Number(line.agency_fee_amount) > 0
      ? roundMoney(Number(line.agency_fee_amount))
      : computeAgencyFeeAmount(
          revenueBeforeVat,
          usageRightsAmount,
          Number(line.agency_fee_percent ?? 0)
        );
  const taxableBase = roundMoney(revenueBeforeVat + usageRightsAmount + agencyFeeAmount);

  return {
    revenueBeforeVat,
    usageRightsAmount,
    agencyFeeAmount,
    taxableBase,
  };
}

function splitInvoicedCommercial(
  invoicedAmount: number,
  commercial: CampaignLineCommercial
): { revenueAmount: number; agencyFeeAmount: number } {
  const invoiced = roundMoney(Math.max(0, invoicedAmount));
  if (invoiced <= 0 || commercial.taxableBase <= 0) {
    return { revenueAmount: 0, agencyFeeAmount: 0 };
  }

  const ratio = invoiced / commercial.taxableBase;
  const revenueAmount = roundMoney((commercial.revenueBeforeVat + commercial.usageRightsAmount) * ratio);
  const agencyFeeAmount = roundMoney(commercial.agencyFeeAmount * ratio);

  return { revenueAmount, agencyFeeAmount };
}

function computeInvoiceCommercialBreakdown(
  invoiceLines: Array<{ campaign_line_id: string | null; revenue_before_vat: number }>,
  commercialByLineId: Map<string, CampaignLineCommercial>
): InvoiceCommercialBreakdown {
  let revenueAmount = 0;
  let agencyFeeAmount = 0;

  for (const item of invoiceLines) {
    if (!item.campaign_line_id) continue;
    const commercial = commercialByLineId.get(item.campaign_line_id);
    if (!commercial) continue;

    const split = splitInvoicedCommercial(Number(item.revenue_before_vat ?? 0), commercial);
    revenueAmount += split.revenueAmount;
    agencyFeeAmount += split.agencyFeeAmount;
  }

  return {
    revenueAmount: roundMoney(revenueAmount),
    agencyFeeAmount: roundMoney(agencyFeeAmount),
  };
}

export async function loadInvoiceDocumentData(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<InvoiceDocumentData> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      `
      id,
      document_number,
      status,
      issue_date,
      due_date,
      subtotal,
      tax_amount,
      total,
      currency,
      notes,
      client:clients(
        id,
        name,
        legal_name,
        document_number,
        vat_number,
        tax_id,
        legal_address,
        billing_address,
        city,
        country,
        payment_terms
      ),
      campaign:${REL.invoices.campaignHeader}(
        id,
        document_number,
        name,
        start_date,
        end_date,
        po_number,
        client_bo_number,
        po_exchange_rate,
        brands:brand_id(name)
      )
    `
    )
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "Invoice not found");
  }

  const typedInvoice = invoice as {
    id: string;
    document_number: string;
    status: string;
    issue_date: string;
    due_date: string | null;
    subtotal: number;
    tax_amount: number;
    total: number;
    currency: string;
    notes: string | null;
    client:
      | {
          id: string;
          name: string;
          legal_name: string | null;
          document_number: string;
          vat_number: string | null;
          tax_id: string | null;
          legal_address: Record<string, unknown>;
          billing_address: Record<string, unknown>;
          city: string | null;
          country: string | null;
          payment_terms: string | null;
        }
      | Array<{
          id: string;
          name: string;
          legal_name: string | null;
          document_number: string;
          vat_number: string | null;
          tax_id: string | null;
          legal_address: Record<string, unknown>;
          billing_address: Record<string, unknown>;
          city: string | null;
          country: string | null;
          payment_terms: string | null;
        }>
      | null;
    campaign:
      | {
          id: string;
          document_number: string;
          name: string;
          start_date: string | null;
          end_date: string | null;
          po_number: string | null;
          client_bo_number: string | null;
          po_exchange_rate: number | null;
          brands: { name: string } | Array<{ name: string }> | null;
        }
      | Array<{
          id: string;
          document_number: string;
          name: string;
          start_date: string | null;
          end_date: string | null;
          po_number: string | null;
          client_bo_number: string | null;
          po_exchange_rate: number | null;
          brands: { name: string } | Array<{ name: string }> | null;
        }>
      | null;
  };

  const client = unwrapRelation(typedInvoice.client);
  if (!client) {
    throw new Error("Missing client data for invoice");
  }

  const campaignRaw = unwrapRelation(typedInvoice.campaign);
  const brand = campaignRaw ? unwrapRelation(campaignRaw.brands) : null;

  const { lines } = await getInvoiceLines(supabase, invoiceId);

  const campaignLineIds = [
    ...new Set(lines.map((line) => line.campaign_line_id).filter(Boolean) as string[]),
  ];

  let clientIoReferences: string[] = [];
  const commercialByLineId = new Map<string, CampaignLineCommercial>();

  if (campaignRaw?.id) {
    const { data: clientIos, error: clientIoError } = await supabase
      .from("client_ios")
      .select("status, sent_at")
      .eq("campaign_header_id", campaignRaw.id);

    if (!clientIoError) {
      const hasGeneratedClientIo = (clientIos ?? []).some((row) => {
        const typed = row as { status?: string | null; sent_at?: string | null };
        return (
          typed.status === "sent" ||
          typed.status === "approved" ||
          typed.status === "generated" ||
          Boolean(typed.sent_at)
        );
      });

      if (hasGeneratedClientIo) {
        const { data: clientIosWithNumber } = await supabase
          .from("client_ios")
          .select("document_number")
          .eq("campaign_header_id", campaignRaw.id);

        clientIoReferences = [
          ...new Set(
            (clientIosWithNumber ?? [])
              .map((row) => (row as { document_number: string | null }).document_number?.trim() ?? null)
              .filter((value): value is string => Boolean(value))
          ),
        ].sort();
      }
    }
  }

  if (campaignLineIds.length > 0) {
    const { data: commercialLines } = await supabase
      .from("campaign_lines")
      .select(
        "id, revenue, revenue_before_vat, usage_rights_amount, agency_fee_amount, agency_fee_percent"
      )
      .in("id", campaignLineIds);

    for (const row of commercialLines ?? []) {
      const typed = row as {
        id: string;
        revenue?: number | null;
        revenue_before_vat?: number | null;
        usage_rights_amount?: number | null;
        agency_fee_amount?: number | null;
        agency_fee_percent?: number | null;
      };
      commercialByLineId.set(typed.id, resolveCampaignLineCommercial(typed));
    }
  }

  const commercialBreakdown = computeInvoiceCommercialBreakdown(lines, commercialByLineId);

  const lineItems: InvoiceLineItemRow[] = lines.map((line) => ({
    id: line.id,
    description: line.description,
    subDescription: buildLineSubDescription({
      deliverableLabel: line.deliverable_label,
      lineDocumentNumber: line.line_document_number,
      campaignName: campaignRaw?.name ?? null,
    }),
    quantity: line.quantity,
    unitPrice: line.unit_price,
    lineTotal: line.line_total,
    revenueBeforeVat: line.revenue_before_vat,
    revenueVatPercent: line.revenue_vat_percent,
    revenueVatAmount: line.revenue_vat_amount,
    revenueVatExempt: line.revenue_vat_exempt,
    lineDocumentNumber: line.line_document_number,
  }));

  const address = formatClientAddress({
    legalAddress: client.legal_address ?? {},
    billingAddress: client.billing_address ?? {},
    city: client.city,
    country: client.country,
  });

  const billingName = client.legal_name?.trim() || client.name;
  const vatPercent = resolveVatPercent(lineItems, THINKWAY_AGENCY_DEFAULTS.defaultVatPercent);

  const currencyCode = typedInvoice.currency;
  const exchangeRate = campaignRaw?.po_exchange_rate;
  const usdEquivalent =
    currencyCode.toUpperCase() === "EGP" && exchangeRate && exchangeRate > 0
      ? Number(typedInvoice.total) / exchangeRate
      : currencyCode.toUpperCase() === "USD"
        ? Number(typedInvoice.total)
        : null;

  const clientIoReferenceDisplay = resolveClientIoReferenceDisplay(clientIoReferences);
  const poReferenceDisplay = resolvePoReferenceDisplay(campaignRaw?.po_number ?? null);
  const clientBoReferenceDisplay = resolveClientBoReferenceDisplay(
    campaignRaw?.client_bo_number ?? null
  );
  const internalReference = campaignRaw?.document_number?.trim() || null;

  return {
    invoiceId: typedInvoice.id,
    documentNumber: typedInvoice.document_number,
    issueDate: typedInvoice.issue_date,
    dueDate: typedInvoice.due_date,
    currencyCode,
    status: typedInvoice.status,
    subtotal: Number(typedInvoice.subtotal ?? 0),
    taxAmount: Number(typedInvoice.tax_amount ?? 0),
    total: Number(typedInvoice.total ?? 0),
    vatPercent,
    notes: typedInvoice.notes,
    usdEquivalent,
    client: {
      id: client.id,
      name: client.name,
      legalName: client.legal_name,
      documentNumber: client.document_number,
      billingName,
      addressLine1: address.line1,
      addressLine2: address.line2,
      cityCountry: address.cityCountry,
      vatNumber: client.vat_number,
      taxId: client.tax_id,
      paymentTerms: formatPaymentTermsLabel(client.payment_terms),
    },
    campaign: campaignRaw
      ? {
          id: campaignRaw.id,
          documentNumber: campaignRaw.document_number,
          name: campaignRaw.name,
          startDate: campaignRaw.start_date,
          endDate: campaignRaw.end_date,
          brandName: brand?.name ?? null,
          poNumber: campaignRaw.po_number,
          clientBoNumber: campaignRaw.client_bo_number,
          clientIoReferences,
          clientIoReferenceDisplay,
          poReferenceDisplay,
          clientBoReferenceDisplay,
          internalReference,
        }
      : null,
    commercialBreakdown,
    lineItems,
  };
}
