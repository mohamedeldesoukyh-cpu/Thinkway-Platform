"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileTextIcon } from "lucide-react";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import {
  CLIENT_IOS_TABLE_COLUMNS,
  ClientIosTable,
} from "@/features/io/components/client-ios-table";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import {
  ClientFormSection,
  ClientProfileTabShell,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { CLIENT_IOS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

export const CLIENT_IO_SAVE_FORM_ID = "client-io-save";

type ClientClientIosTabProps = {
  clientId: string;
  clientName: string;
  clientIoTermsText: string | null;
  rows: ClientIoRow[];
  recipients: ClientIoSendRecipient[];
  onCancel?: () => void;
};

export function ClientClientIosTab({
  clientId,
  clientName,
  clientIoTermsText,
  rows,
  recipients,
  onCancel,
}: ClientClientIosTabProps) {
  const platformV6 = useClientProfilePlatformV6();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const filterAccessors = useMemo(() => {
    const { client: _client, ...rest } = CLIENT_IOS_FILTER_ACCESSORS;
    return rest;
  }, []);

  const registerToolbar = (
    <>
      <Link
        href={`/ios/client?client=${clientId}`}
        className={cn(platformV6 && "platform-v6-btn platform-v6-btn-sm")}
      >
        Open IO register
      </Link>
      <OperationalTableControlsSlot contextLabel="Client IO register" />
    </>
  );

  return (
    <ClientProfileTabShell
      title="Client IO"
      description={`All client insertion orders issued to ${clientName}.`}
      onCancel={onCancel}
    >
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientClientIos}
        columns={CLIENT_IOS_TABLE_COLUMNS}
        rows={rows}
        filterAccessors={filterAccessors}
      >
        <ClientFormSection
          icon={FileTextIcon}
          title="Client IO register"
          description="Select a row to review terms, recipients, and send history."
          toolbar={registerToolbar}
          bodyClassName={platformV6 ? "platform-v6-wide-form-body-table" : undefined}
        >
          {rows.length === 0 ? (
            <div className={cn(platformV6 ? "platform-v6-empty-state" : "py-6")}>
              <p className={cn(!platformV6 && "text-[13px] text-[#9099A8]")}>
                No client IOs issued for this legal entity yet. IOs are created from
                campaign workspaces when a campaign is prepared for client approval.
              </p>
            </div>
          ) : (
            <div className={cn("overflow-x-auto", !platformV6 && "-mx-[22px]")}>
              <ClientIosTable
                rows={rows}
                selectedId={selected?.id ?? null}
                onView={setSelectedId}
                showClientColumn={false}
                platformV6={platformV6}
              />
            </div>
          )}
        </ClientFormSection>
      </OperationalTableSuiteProvider>

      {selected ? (
        <ClientFormSection
          icon={FileTextIcon}
          title={selected.document_number ?? "Client IO detail"}
          description={`Review and manage ${selected.brand_name ?? "this IO"}.`}
          className={platformV6 ? "mt-3.5" : undefined}
        >
          <ClientIoForm
            key={selected.id}
            row={selected}
            recipients={recipients}
            clientDefaultTermsText={selected.client_io_terms_text ?? clientIoTermsText}
            brandName={selected.brand_name}
          />
        </ClientFormSection>
      ) : null}
    </ClientProfileTabShell>
  );
}
