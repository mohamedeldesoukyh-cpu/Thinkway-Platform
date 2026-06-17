"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import {
  CLIENT_IOS_TABLE_COLUMNS,
  ClientIosTable,
} from "@/features/io/components/client-ios-table";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import { CLIENT_IOS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

type ClientClientIosTabProps = {
  clientId: string;
  clientName: string;
  clientIoTermsText: string | null;
  rows: ClientIoRow[];
  recipients: ClientIoSendRecipient[];
};

export function ClientClientIosTab({
  clientId,
  clientName,
  clientIoTermsText,
  rows,
  recipients,
}: ClientClientIosTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const filterAccessors = useMemo(() => {
    const { client: _client, ...rest } = CLIENT_IOS_FILTER_ACCESSORS;
    return rest;
  }, []);

  return (
    <div className="space-y-4">
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientClientIos}
        columns={CLIENT_IOS_TABLE_COLUMNS}
        rows={rows}
        filterAccessors={filterAccessors}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Client IOs"
              description={`All client insertion orders issued to ${clientName}.`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/ios/client?client=${clientId}`}>Open IO register</Link>
                  </Button>
                  <OperationalTableControlsSlot contextLabel="Client IOs" />
                </div>
              }
            />
          }
        >
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No client IOs issued for this legal entity yet. IOs are created from campaign
              workspaces when a campaign is prepared for client approval.
            </p>
          ) : (
            <ClientIosTable
              rows={rows}
              selectedId={selected?.id ?? null}
              onView={setSelectedId}
              showClientColumn={false}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      {selected ? (
        <div className={cn("rounded-xl border border-border/70 bg-card shadow-sm")}>
          <ClientIoForm
            key={selected.id}
            row={selected}
            recipients={recipients}
            clientDefaultTermsText={selected.client_io_terms_text ?? clientIoTermsText}
            brandName={selected.brand_name}
          />
        </div>
      ) : null}
    </div>
  );
}
