"use client";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { FinanceSuiteEmpty } from "@/components/finance/suite";
import {
  ADJUSTMENT_REGISTER_COLUMN_METAS,
  AdjustmentRegisterTable,
} from "@/features/finance/adjustments/components/adjustment-register-table";
import type { FinanceAdjustmentRegisterRow } from "@/features/finance/adjustments/types";
import { adjustmentKindFromModule } from "@/features/finance/adjustments/adjustment-kind-map";
import type { AdjustmentModuleKey } from "@/lib/finance/status/document-kind";
import { financeAdjustmentRegisterTableId } from "@/lib/tables/operational-table-ids";
import { ADJUSTMENT_REGISTER_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";

type AdjustmentRegisterSectionProps = {
  moduleKey: AdjustmentModuleKey;
  rows: FinanceAdjustmentRegisterRow[];
  description: string;
};

export function AdjustmentRegisterSection({
  moduleKey,
  rows,
  description,
}: AdjustmentRegisterSectionProps) {
  const kind = adjustmentKindFromModule(moduleKey);

  return (
    <OperationalTableSuiteProvider
      tableId={financeAdjustmentRegisterTableId(moduleKey)}
      columns={operationalColumnsFromMetas(ADJUSTMENT_REGISTER_COLUMN_METAS, ADJUSTMENT_REGISTER_FILTER_ACCESSORS)}
      rows={rows}
      filterAccessors={ADJUSTMENT_REGISTER_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        title="Register"
        description={description}
        actions={<OperationalTableControlsSlot contextLabel="Adjustment register" />}
      >
        {rows.length === 0 ? (
          <FinanceSuiteEmpty
            title="No documents in this register yet"
            body="The schema is live and serial numbers are reserved. Nothing has been raised, so there is nothing to reconcile."
          />
        ) : (
          <AdjustmentRegisterTable rows={rows} kind={kind} />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
