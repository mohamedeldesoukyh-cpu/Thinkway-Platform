import {
  computeClientBilling,
  resolveClientTaxableBase,
} from "@/lib/assignments/client-billing-commercial";
import { roundMoney } from "@/lib/vat/calculations";

export type ClientBillableFields = {
  revenue_before_vat?: number | null;
  usage_rights_amount?: number | null;
  agency_fee_amount?: number | null;
  agency_fee_percent?: number | null;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
  remaining_amount?: number | null;
  locked_at?: string | null;
};

/** Client billable = Revenue + UR Rev + Fees (max of computed base vs stored billable). */
export function resolveClientBillableAmount(input: ClientBillableFields): number {
  const taxableBase = resolveClientTaxableBase({
    revenueBeforeVat: Number(input.revenue_before_vat ?? 0),
    usageRightsAmount: Number(input.usage_rights_amount ?? 0),
    agencyFeeAmount:
      input.agency_fee_amount != null ? Number(input.agency_fee_amount) : null,
    agencyFeePercent: Number(input.agency_fee_percent ?? 0),
  });
  const stored = Number(input.billable_amount ?? 0);
  return roundMoney(Math.max(taxableBase, stored));
}

export function resolveClientRemainingAmount(input: ClientBillableFields): number {
  const billable = resolveClientBillableAmount(input);
  const invoiced = Number(input.invoiced_amount ?? 0);
  const storedRemaining = Number(input.remaining_amount ?? NaN);
  if (input.locked_at && Number.isFinite(storedRemaining) && storedRemaining >= 0) {
    return roundMoney(storedRemaining);
  }
  return roundMoney(Math.max(0, billable - invoiced));
}

export function resolveInvoicePreviewBeforeVat(input: ClientBillableFields): number {
  const remaining = resolveClientRemainingAmount(input);
  if (remaining > 0) return remaining;
  return resolveClientBillableAmount(input);
}

export function computeClientInvoiceVatPreview(input: ClientBillableFields & {
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
}) {
  const beforeVat = resolveInvoicePreviewBeforeVat(input);
  const billing = computeClientBilling({
    revenueBeforeVat: beforeVat,
    vatPercent: input.revenue_vat_exempt ? 0 : input.revenue_vat_percent,
    vatExempt: input.revenue_vat_exempt,
  });
  return {
    beforeVat,
    vatAmount: billing.vatAmount,
    afterVat: billing.totalBilling,
    vatPercent: billing.vatPercent,
    exempt: input.revenue_vat_exempt,
  };
}

/** Splits deliverable client billable across posts by revenue share. */
export function allocateAmountByRevenueShare(
  totalAmount: number,
  posts: Array<{ id: string; revenue_before_vat?: number | null }>
): Map<string, number> {
  const shares = new Map<string, number>();
  if (posts.length === 0) return shares;

  const totalRevenue = posts.reduce(
    (sum, post) => sum + Math.max(0, Number(post.revenue_before_vat ?? 0)),
    0
  );

  if (totalRevenue <= 0) {
    const even = roundMoney(totalAmount / posts.length);
    for (const post of posts) {
      shares.set(post.id, even);
    }
    return shares;
  }

  let allocated = 0;
  for (let index = 0; index < posts.length; index++) {
    const post = posts[index]!;
    const revenue = Math.max(0, Number(post.revenue_before_vat ?? 0));
    const isLast = index === posts.length - 1;
    const share = isLast
      ? roundMoney(totalAmount - allocated)
      : roundMoney((revenue / totalRevenue) * totalAmount);
    shares.set(post.id, share);
    allocated = roundMoney(allocated + share);
  }

  return shares;
}
