import type {
  ClientIoCampaignPricing,
  ClientIoDocumentData,
} from "@/lib/io/client-io-document-types";

export type ClientIoDocumentLayout = "detailed" | "package" | "package_main";

export type ClientIoPricingRow = {
  label: string;
  amount: number | null;
  variant?: "normal" | "header" | "subtotal" | "total";
};

export function isClientIoDocumentLayout(
  value: string | null | undefined
): value is ClientIoDocumentLayout {
  return value === "detailed" || value === "package" || value === "package_main";
}

export function resolveClientIoDocumentLayout(
  value: string | null | undefined
): ClientIoDocumentLayout {
  return isClientIoDocumentLayout(value) ? value : "detailed";
}

function formatAssignmentHeader(line: ClientIoCampaignPricing["assignmentLines"][number]): string {
  const ref = line.lineDocumentNumber?.trim();
  const name = line.influencerName.trim() || line.lineName.trim();
  if (ref && name) return `${name} — ${ref}`;
  return ref || name || line.lineName || "Assignment";
}

/** Builds client-visible pricing rows (revenue, UR, AF only — never cost or GP). */
export function buildClientIoPricingRows(
  pricing: ClientIoCampaignPricing,
  layout: ClientIoDocumentLayout
): ClientIoPricingRow[] {
  if (layout === "package" || layout === "package_main") {
    return [
      { label: "Influencer Fees (Total)", amount: pricing.revenueTotal },
      { label: "Usage Rights Fee", amount: pricing.usageRightsTotal },
      { label: "Agency Fee", amount: pricing.agencyFeeTotal },
      { label: "Subtotal", amount: pricing.subtotal, variant: "subtotal" },
      { label: `VAT (${pricing.vatPercent}%)`, amount: pricing.vatAmount },
      { label: "Total Amount Due", amount: pricing.total, variant: "total" },
    ];
  }

  const rows: ClientIoPricingRow[] = [];

  for (const line of pricing.assignmentLines) {
    rows.push({ label: formatAssignmentHeader(line), amount: null, variant: "header" });
    rows.push({ label: "Influencer Fees", amount: line.revenueBeforeVat });
    rows.push({ label: "Usage Rights Fee", amount: line.usageRightsAmount });
    rows.push({ label: "Agency Fee", amount: line.agencyFeeAmount });
  }

  rows.push({ label: "Subtotal", amount: pricing.subtotal, variant: "subtotal" });
  rows.push({ label: `VAT (${pricing.vatPercent}%)`, amount: pricing.vatAmount });
  rows.push({ label: "Total Amount Due", amount: pricing.total, variant: "total" });

  return rows;
}

export function resolveClientIoDeliverableRows(
  data: ClientIoDocumentData,
  layout: ClientIoDocumentLayout
): ClientIoDocumentData["deliverables"] {
  if (layout === "package_main") {
    return data.mainAssignmentDeliverables;
  }
  return data.deliverables;
}

export function applyClientIoDocumentLayout(
  data: ClientIoDocumentData,
  layout: ClientIoDocumentLayout
): ClientIoDocumentData & { pricingRows: ClientIoPricingRow[] } {
  return {
    ...data,
    pricingRows: buildClientIoPricingRows(data.pricing, layout),
  };
}
