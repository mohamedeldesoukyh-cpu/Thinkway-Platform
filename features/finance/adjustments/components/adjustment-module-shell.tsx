import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { FinanceSuiteEmpty, FinanceSuiteKpiStrip } from "@/components/finance/suite";
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
    <div className="space-y-4">
      <FinanceSuiteKpiStrip
        items={[
          {
            id: "docs",
            label: "Documents",
            value: String(rows.length),
            hint: rows.length === 0 ? "register is live, empty" : "historical serials retained",
          },
          {
            id: "serials",
            label: "Serials issued",
            value: String(rows.length),
            hint: "no deletes, reverse instead",
          },
          {
            id: "party",
            label: config.party === "client" ? "Client" : "Vendor",
            value: config.direction === "credit" ? "Credit" : "Debit",
            hint: config.sourceLabel,
          },
          {
            id: "effect",
            label: "Effect",
            value:
              config.party === "client"
                ? config.direction === "credit"
                  ? "Reduces A/R"
                  : "Increases A/R"
                : config.direction === "credit"
                  ? "Reduces A/P"
                  : "Increases A/P",
          },
        ]}
      />

      {moduleKey === "client_credit" ? (
        <OperationalTableSection
          title="New client credit note"
          description="Search an invoice, then issue a draft CN. Posted CNs lock invoice cancellation until resolved."
        >
          <ClientCreditNoteWorkspace invoices={invoices} />
        </OperationalTableSection>
      ) : (
        <div className="thinkway-campaign-section-card">
          <div className="thinkway-campaign-section-head">
            <div className="min-w-0">
              <h2>{config.title} workspace</h2>
              <p>Register and schema are live · no deletes, reverse instead</p>
            </div>
          </div>
          <FinanceSuiteEmpty
            title="No documents in this register yet"
            body={`The schema is live and serial numbers are reserved. Source search for ${config.sourceLabel} follows the same pattern as client credit notes.`}
          />
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
