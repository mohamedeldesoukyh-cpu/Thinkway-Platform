import type { BudgetPeriodType } from "@/lib/planning/types/budget";

export type BudgetPeriodSeed = {
  period_type: BudgetPeriodType;
  period_key: string;
  period_start: string;
  period_end: string;
  sort_order: number;
};

export function buildBudgetPeriodSeeds(
  fiscalYear: number,
  periodType: BudgetPeriodType
): BudgetPeriodSeed[] {
  if (periodType === "yearly") {
    return [
      {
        period_type: "yearly",
        period_key: String(fiscalYear),
        period_start: `${fiscalYear}-01-01`,
        period_end: `${fiscalYear}-12-31`,
        sort_order: 0,
      },
    ];
  }

  if (periodType === "quarterly") {
    return [1, 2, 3, 4].map((q, index) => {
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const lastDay = new Date(fiscalYear, endMonth, 0).getDate();
      return {
        period_type: "quarterly" as const,
        period_key: `${fiscalYear}-Q${q}`,
        period_start: `${fiscalYear}-${String(startMonth).padStart(2, "0")}-01`,
        period_end: `${fiscalYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
        sort_order: index,
      };
    });
  }

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const month = monthIndex + 1;
    const lastDay = new Date(fiscalYear, month, 0).getDate();
    const key = `${fiscalYear}-${String(month).padStart(2, "0")}`;
    return {
      period_type: "monthly" as const,
      period_key: key,
      period_start: `${fiscalYear}-${String(month).padStart(2, "0")}-01`,
      period_end: `${fiscalYear}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      sort_order: monthIndex,
    };
  });
}
