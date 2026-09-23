import { assignmentClientBilling } from "@/lib/assignments/client-billing-commercial";
import { creatorFxAmount } from "@/lib/commercial/creator-fx";
import { roundMoney } from "@/lib/vat/calculations";
import { formatMoneyDetail } from "@/lib/finance/currency-format";

export function formatIoCampaignDuration(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const start = formatIoShortDate(startDate);
  const end = formatIoShortDate(endDate);
  if (start === "—" && end === "—") return "—";
  if (start === "—") return end;
  if (end === "—") return start;
  return `${start} – ${end}`;
}

export function formatIoShortDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatIoAgreedAmount(
  amount: number | null | undefined,
  currencyCode: string | null | undefined
): string {
  // null/undefined must not coerce via Number(null) === 0.
  if (amount == null) return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return formatMoneyDetail(value, currencyCode);
}


/** The email must use the generated document's frozen total and its own currency. */
export function clientIoGeneratedEmailTotal(total: { amount: number; currency: string } | null | undefined): { amount: number; currencyCode: string } | null {
  if (!total || !Number.isFinite(total.amount) || !total.currency.trim()) return null;
  return { amount: total.amount, currencyCode: total.currency };
}

/** Draft preview only. Issued documents always use clientIoGeneratedEmailTotal. */
export function sumClientIoComposerAgreedAmount(
  assignments: Array<{
    id: string; revenue_before_vat?: number | null; currency_code?: string | null;
    usage_rights_amount?: number | null; agency_fee_amount?: number | null;
    agency_fee_percent?: number | null; revenue_vat_percent?: number | null;
    revenue_vat_exempt?: boolean | null; revenue_fx_override?: string | null;
  }>,
  selectedAssignmentIds: string[] | null | undefined,
  fallbackCurrencyCode?: string | null,
  rates: Record<string, number> = {}
): { amount: number; currencyCode: string } | null {
  const selected = assignments.filter(row => selectedAssignmentIds?.includes(row.id));
  if (!selected.length) return null;
  const currencyCode = fallbackCurrencyCode?.trim() || selected[0]?.currency_code?.trim() || "USD";
  try {
    const amount = selected.reduce((sum, row) => {
      const source = row.currency_code?.trim() || currencyCode;
      const billing = assignmentClientBilling({ ...row, revenue_before_vat: Number(row.revenue_before_vat ?? 0) });
      return sum + creatorFxAmount(billing.totalBilling, {
        from: source, to: currencyCode, sourceRateToEgp: rates[source] ?? 0,
        targetRateToEgp: rates[currencyCode] ?? 0, override: row.revenue_fx_override,
      });
    }, 0);
    return { amount: roundMoney(amount), currencyCode };
  } catch { return null; }
}
