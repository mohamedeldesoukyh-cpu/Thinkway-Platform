import { roundMoney } from "@/lib/analytics/aggregations/round";
import { invoiceOutstanding } from "@/lib/collections/aging/compute-bucket";
import { devLog } from "@/lib/platform/logger";

export type AllocationTarget = {
  invoice_id: string;
  document_number?: string;
  total: number;
  amount_paid: number;
  requested_amount: number;
};

export type AllocationLine = {
  invoice_id: string;
  allocated_amount: number;
  outstanding_before: number;
  outstanding_after: number;
  is_overpayment: boolean;
  is_underpayment: boolean;
};

export type AllocationPlanResult =
  | {
      ok: true;
      lines: AllocationLine[];
      total_allocated: number;
      remainder: number;
    }
  | { ok: false; error: string };

export function buildAllocationPlan(
  paymentAmount: number,
  targets: AllocationTarget[]
): AllocationPlanResult {
  if (paymentAmount <= 0) {
    return { ok: false, error: "Payment amount must be positive." };
  }
  if (targets.length === 0) {
    return { ok: false, error: "Select at least one invoice." };
  }

  const requestedTotal = roundMoney(
    targets.reduce((s, t) => s + Math.max(0, t.requested_amount), 0)
  );

  let remaining = roundMoney(paymentAmount);
  const lines: AllocationLine[] = [];

  const sorted = [...targets].sort((a, b) => {
    const oa = invoiceOutstanding(a.total, a.amount_paid);
    const ob = invoiceOutstanding(b.total, b.amount_paid);
    return ob - oa;
  });

  if (requestedTotal > 0 && Math.abs(requestedTotal - paymentAmount) > 0.01) {
    for (const target of sorted) {
      if (remaining <= 0) break;
      const outstanding = invoiceOutstanding(target.total, target.amount_paid);
      if (outstanding <= 0) continue;
      const share =
        requestedTotal > 0
          ? roundMoney((target.requested_amount / requestedTotal) * paymentAmount)
          : 0;
      const allocated = roundMoney(Math.min(remaining, Math.min(outstanding, share)));
      if (allocated <= 0) continue;
      lines.push(buildLine(target, allocated));
      remaining = roundMoney(remaining - allocated);
    }
  } else {
    for (const target of sorted) {
      if (remaining <= 0) break;
      const outstanding = invoiceOutstanding(target.total, target.amount_paid);
      if (outstanding <= 0) continue;
      const allocated = roundMoney(
        Math.min(remaining, target.requested_amount > 0 ? target.requested_amount : outstanding)
      );
      if (allocated <= 0) continue;
      lines.push(buildLine(target, allocated));
      remaining = roundMoney(remaining - allocated);
    }
  }

  if (lines.length === 0) {
    return { ok: false, error: "No allocatable balance on selected invoices." };
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[payment-allocation] plan built", {
      lines: lines.length,
      remainder: remaining,
    });
  }

  return {
    ok: true,
    lines,
    total_allocated: roundMoney(paymentAmount - remaining),
    remainder: remaining,
  };
}

function buildLine(target: AllocationTarget, allocated: number): AllocationLine {
  const outstanding_before = invoiceOutstanding(target.total, target.amount_paid);
  const outstanding_after = roundMoney(Math.max(0, outstanding_before - allocated));
  return {
    invoice_id: target.invoice_id,
    allocated_amount: allocated,
    outstanding_before,
    outstanding_after,
    is_overpayment: allocated > outstanding_before,
    is_underpayment: outstanding_after > 0 && allocated < outstanding_before,
  };
}
