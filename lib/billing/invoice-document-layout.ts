import type {
  InvoiceDocumentData,
  InvoiceLineItemRow,
} from "@/lib/billing/invoice-document-types";
import { deliverableTypeLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { computeVatLine, roundMoney } from "@/lib/vat/calculations";

export type InvoiceDocumentLayout = "detailed" | "by_creator" | "package";

export function isInvoiceDocumentLayout(value: string | null | undefined): value is InvoiceDocumentLayout {
  return value === "detailed" || value === "by_creator" || value === "package";
}

export function resolveInvoiceDocumentLayout(
  value: string | null | undefined
): InvoiceDocumentLayout {
  return isInvoiceDocumentLayout(value) ? value : "detailed";
}

function billingPercentageLabel(lines: InvoiceLineItemRow[]): string {
  const matches=lines.map(line=>line.description.match(/(\d+(?:\.\d+)?)% of original billable amount/));
  if(!matches.some(Boolean))return '';
  const percentages=[...new Set(matches.map(match=>match?.[1]??'100'))];
  return percentages.length===1 ? percentages[0]+'% of original billable amount' : 'Mixed billing: '+percentages.map(value=>value+'%').join(', ')+' of respective original item amounts';
}
function withBillingPercentage(description: string, lines: InvoiceLineItemRow[]): string {
  const label=billingPercentageLabel(lines);
  return label ? description.replace(/\s*[·-]\s*\d+(?:\.\d+)?% of original billable amount/g,'')+' · '+label : description;
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

/** Strip trailing " · Deliverable #n" from invoice child descriptions. */
export function stripDeliverableSuffix(description: string): string {
  return description
    .replace(/\s*[·-]\s*\d+(?:\.\d+)?% of original billable amount$/, "")
    .replace(/\s*·\s*[^·]+ #\d+$/, "")
    .trim();
}

function creatorGroupKey(line: InvoiceLineItemRow): string {
  if (line.lineDocumentNumber?.trim()) return line.lineDocumentNumber.trim();
  return stripDeliverableSuffix(line.description);
}

function creatorDescription(lines: InvoiceLineItemRow[]): string {
  const first = lines[0];
  const name = first.creatorName || stripDeliverableSuffix(first.description).split(" — ")[1] || stripDeliverableSuffix(first.description);
  const items = new Map<string, number>();
  const mixed = new Set(lines.map(line => line.description.match(/(\d+(?:\.\d+)?)% of original billable amount/)?.[1] ?? "100")).size > 1;
  for (const line of lines) {
    const raw = line.description.replace(/\s*[·-]\s*\d+(?:\.\d+)?% of original billable amount$/, "").match(/·\s*([^·]+?)\s+#\d+$/)?.[1];
    if (!raw) continue;
    const tokens = raw.trim().split(/\s+/);
    const platform = tokens[0];
    const code = tokens.slice(1).join("_").toLowerCase();
    const aliases: Record<string, string> = { ig_reel: "instagram_reel", stories: "instagram_story", story: "instagram_story", reel: "instagram_reel" };
    const label = deliverableTypeLabel(aliases[code] ?? code);
    const fullLabel = label.toLowerCase().startsWith(platform.toLowerCase()) ? label : platform + " " + label;
    const percentage = line.description.match(/(\d+(?:\.\d+)?)% of original billable amount/)?.[1] ?? "100";
    const key = fullLabel + (mixed ? " (" + percentage + "% billed)" : "");
    items.set(key, (items.get(key) ?? 0) + Number(line.quantity || 1));
  }
  const deliverables = [...items].map(([label, quantity]) => quantity + " × " + label).join(" + ");
  const description = [name, deliverables].filter(Boolean).join(" — ");
  return mixed ? description : withBillingPercentage(description, lines) + (billingPercentageLabel(lines) ? "" : " · 100% of original billable amount");
}

/** Aggregate child invoice rows into one row per creator / campaign line. */
export function aggregateInvoiceLinesByCreator(
  lines: InvoiceLineItemRow[]
): InvoiceLineItemRow[] {
  const groups = new Map<
    string,
    {
      id: string;
      description: string;
      lineDocumentNumber: string | null;
      revenueBeforeVat: number;
      revenueVatAmount: number;
      lineTotal: number;
      revenueVatPercent: number;
      revenueVatExempt: boolean;
      childCount: number;
      sourceLines: InvoiceLineItemRow[];
    }
  >();

  for (const line of lines) {
    const key = creatorGroupKey(line);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: `creator-${key}`,
        description: stripDeliverableSuffix(line.description),
        lineDocumentNumber: line.lineDocumentNumber,
        revenueBeforeVat: Number(line.revenueBeforeVat ?? 0),
        revenueVatAmount: Number(line.revenueVatAmount ?? 0),
        lineTotal: Number(line.lineTotal ?? 0),
        revenueVatPercent: line.revenueVatPercent,
        revenueVatExempt: line.revenueVatExempt,
        childCount: 1,
        sourceLines: [line],
      });
      continue;
    }

    existing.revenueBeforeVat = roundMoney(
      existing.revenueBeforeVat + Number(line.revenueBeforeVat ?? 0)
    );
    existing.revenueVatAmount = roundMoney(
      existing.revenueVatAmount + Number(line.revenueVatAmount ?? 0)
    );
    existing.lineTotal = roundMoney(existing.lineTotal + Number(line.lineTotal ?? 0));
    existing.childCount += 1;
    existing.sourceLines.push(line);
    if (!existing.revenueVatExempt && line.revenueVatExempt) {
      // keep taxable if any child is taxable
    } else if (existing.revenueVatExempt && !line.revenueVatExempt) {
      existing.revenueVatExempt = false;
      existing.revenueVatPercent = line.revenueVatPercent;
    }
  }

  return [...groups.values()].map((group) => ({
    id: group.id,
    description: creatorDescription(group.sourceLines),
    subDescription: null,
    quantity: 1,
    unitPrice: group.revenueBeforeVat,
    revenueBeforeVat: group.revenueBeforeVat,
    revenueVatPercent: group.revenueVatPercent,
    revenueVatAmount: group.revenueVatAmount,
    revenueVatExempt: group.revenueVatExempt,
    lineTotal: group.lineTotal,
    lineDocumentNumber: group.lineDocumentNumber,
  }));
}

/** Package / lump-sum view: campaign summary with revenue and agency fees on separate lines. */
function applyPackageLayout(data: InvoiceDocumentData): InvoiceDocumentData {
  const campaignLabel = data.campaign?.name?.trim() || "Campaign services";
  const subDescription = buildPackageSubDescription(data);
  const vatExempt = data.taxAmount <= 0 && data.subtotal > 0 && data.vatPercent <= 0;
  const { revenueAmount, agencyFeeAmount } = data.commercialBreakdown;

  const packageLines: InvoiceLineItemRow[] = [];

  if (revenueAmount > 0) {
    packageLines.push(
      buildPackageLineItem({
        id: "package-revenue",
        description: withBillingPercentage(campaignLabel, data.lineItems),
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
        description: withBillingPercentage("Agency fees", data.lineItems),
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
        description: withBillingPercentage(campaignLabel, data.lineItems),
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

/**
 * Apply invoice preview/download layout:
 * - detailed: child rows (posts / deliverables)
 * - by_creator: one amount row per creator campaign line
 * - package: lump-sum campaign + agency fee lines
 */
export function applyInvoiceDocumentLayout(
  data: InvoiceDocumentData,
  layout: InvoiceDocumentLayout
): InvoiceDocumentData {
  if (layout === "detailed") return data;
  if (layout === "by_creator") {
    return {
      ...data,
      lineItems: aggregateInvoiceLinesByCreator(data.lineItems),
    };
  }
  return applyPackageLayout(data);
}
