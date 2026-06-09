import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { AdjustmentRegisterSection } from "@/features/finance/adjustments/components/adjustment-register-section";
import { ClientCreditNoteWorkspace } from "@/features/finance/adjustments/components/client-credit-note-workspace";
import { getAdjustmentRegister, searchInvoicesForAdjustment } from "@/features/finance/adjustments/queries";
import type { AdjustmentModuleKey } from "@/lib/finance/status/document-kind";
import { ADJUSTMENT_MODULE_CONFIG } from "@/lib/finance/status/document-kind";

type AdjustmentModuleShellProps = {
  moduleKey: AdjustmentModuleKey;
};

export async function AdjustmentModuleShell({ moduleKey }: AdjustmentModuleShellProps) {
  const config = ADJUSTMENT_MODULE_CONFIG[moduleKey];
  const [rows, invoices] = await Promise.all([
    getAdjustmentRegister(moduleKey),
    moduleKey === "client_credit" ? searchInvoicesForAdjustment() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {moduleKey === "client_credit" ? (
        <OperationalTableSection
          title="New client credit note"
          description="Search an invoice, then issue a draft CN. Posted CNs lock invoice cancellation until resolved."
        >
          <ClientCreditNoteWorkspace invoices={invoices} />
        </OperationalTableSection>
      ) : (
        <div className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{config.title} workspace</p>
          <p className="mt-1">
            Register and schema are live. Source search workflow for {config.sourceLabel} follows
            the same pattern as client credit notes — connect {config.party} documents in the
            next sprint.
          </p>
        </div>
      )}

      <AdjustmentRegisterSection
        moduleKey={moduleKey}
        rows={rows}
        description={`${rows.length} document${rows.length === 1 ? "" : "s"} — historical serials retained (no deletes).`}
      />
    </div>
  );
}
