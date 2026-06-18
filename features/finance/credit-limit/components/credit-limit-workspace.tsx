"use client";

import Link from "next/link";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { formatCurrencyAmount } from "@/lib/finance/currency-format";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

import {
  AcceptCreditRiskSwitch,
  CreditLimitActiveSwitch,
  CreditLimitAmountInput,
  CreditLimitRowProvider,
} from "./credit-limit-row-context";
import type { ClientCreditLimitRow, CreditLimitWorkspaceData } from "../types";

type CreditLimitWorkspaceProps = {
  data: CreditLimitWorkspaceData;
};

function renderLegalEntity(client: ClientCreditLimitRow) {
  const legalName = client.legal_name?.trim();
  const showLegalSubtitle =
    Boolean(legalName) && legalName!.toLowerCase() !== client.name.trim().toLowerCase();

  return (
    <div className="flex flex-col">
      <Link
        href={`/clients/${client.id}`}
        className="font-medium text-foreground hover:text-primary hover:underline"
      >
        {client.name}
      </Link>
      {showLegalSubtitle ? (
        <span className="text-[11px] text-muted-foreground">{legalName}</span>
      ) : null}
    </div>
  );
}

function renderExposure(client: ClientCreditLimitRow) {
  return formatCurrencyAmount(client.exposure, client.currency);
}

function renderAvailable(client: ClientCreditLimitRow) {
  if (client.credit_limit == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const available = client.available ?? 0;
  const exceeded = available <= 0 && client.exposure > client.credit_limit;

  return (
    <span
      className={cn(
        exceeded && "font-medium text-destructive",
        !exceeded && available <= client.credit_limit * 0.1 && "text-amber-600 dark:text-amber-400"
      )}
    >
      {formatCurrencyAmount(available, client.currency)}
    </span>
  );
}

const CREDIT_LIMIT_COLUMNS: OperationalConfigurableColumnDef<ClientCreditLimitRow>[] = [
  {
    id: "document_number",
    label: "Client #",
    monoCell: true,
    colWidth: "9%",
    locked: true,
    renderCell: (client) => <DocumentNumber value={client.document_number} />,
  },
  {
    id: "legal_entity",
    label: "Legal entity",
    colWidth: "22%",
    locked: true,
    renderCell: renderLegalEntity,
  },
  {
    id: "credit_limit",
    label: "Credit limit",
    colWidth: "12%",
    amountCell: true,
    renderCell: () => <CreditLimitAmountInput />,
  },
  {
    id: "credit_limit_active",
    label: "CL Active",
    colWidth: "9%",
    renderCell: () => (
      <div className="flex justify-center">
        <CreditLimitActiveSwitch />
      </div>
    ),
  },
  {
    id: "accept_credit_risk",
    label: "Accept risk",
    colWidth: "9%",
    renderCell: () => (
      <div className="flex justify-center">
        <AcceptCreditRiskSwitch />
      </div>
    ),
  },
  {
    id: "exposure",
    label: "Exposure",
    colWidth: "12%",
    amountCell: true,
    renderCell: renderExposure,
  },
  {
    id: "available",
    label: "Available",
    colWidth: "12%",
    amountCell: true,
    renderCell: renderAvailable,
  },
];

export function CreditLimitWorkspace({ data }: CreditLimitWorkspaceProps) {
  const meta =
    data.total === 1 ? "1 client" : `${data.total.toLocaleString()} clients`;

  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.financeCreditLimit}
      columns={CREDIT_LIMIT_COLUMNS}
      rows={data.clients}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="min-w-0 space-y-0.5 px-4 pt-4 md:px-5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Client credit limits
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {meta} · edits sync with each client&apos;s Finance tab
            </p>
          </div>
        }
      >
        {data.clients.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground md:px-5">
            No clients found.
          </div>
        ) : (
          <OperationalConfigurableTable
            columns={CREDIT_LIMIT_COLUMNS}
            rows={data.clients}
            rowKey={(client) => client.id}
            wrapRow={(client, rowElement) => (
              <CreditLimitRowProvider client={client}>{rowElement}</CreditLimitRowProvider>
            )}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
