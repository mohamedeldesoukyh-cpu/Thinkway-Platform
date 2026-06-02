import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { BudgetAllocation } from "@/lib/planning/types/budget";

export type AllocationSummary = {
  budget_line_id: string;
  total_allocated: number;
  unallocated: number;
  allocation_count: number;
};

export function summarizeAllocations(
  lineTotal: number,
  allocations: Pick<BudgetAllocation, "allocated_amount">[]
): AllocationSummary {
  const total_allocated = roundMoney(
    allocations.reduce((sum, row) => sum + Number(row.allocated_amount), 0)
  );

  return {
    budget_line_id: "",
    total_allocated,
    unallocated: roundMoney(Math.max(0, lineTotal - total_allocated)),
    allocation_count: allocations.length,
  };
}
