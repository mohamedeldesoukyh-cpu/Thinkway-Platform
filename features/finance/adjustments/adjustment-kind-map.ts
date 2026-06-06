import type { AdjustmentTableKind } from "@/lib/finance/adjustment-table-config";
import type { AdjustmentModuleKey } from "@/lib/finance/status/document-kind";

export function adjustmentKindFromModule(moduleKey: AdjustmentModuleKey): AdjustmentTableKind {
  const map: Record<AdjustmentModuleKey, AdjustmentTableKind> = {
    client_credit: "client_credit_note",
    vendor_credit: "vendor_credit_note",
    client_debit: "client_debit_note",
    vendor_debit: "vendor_debit_note",
  };
  return map[moduleKey];
}
