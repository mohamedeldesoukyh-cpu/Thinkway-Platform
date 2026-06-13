"use client";

import type { ReactNode } from "react";
import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CLIENT_IOS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import {
  CLIENT_IOS_TABLE_COLUMNS,
  ClientIosTable,
} from "@/features/io/components/client-ios-table";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type Props = {
  rows: ClientIoRow[];
  initialSelectedId: string | null;
  recipientsByClientId: Record<string, ClientIoSendRecipient[]>;
  leading?: ReactNode;
};

export function ClientIosWorkspace({
  rows,
  initialSelectedId,
  recipientsByClientId,
  leading,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedId = searchParams.get("io") ?? initialSelectedId;
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId]
  );

  function handleView(ioId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("io", ioId);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.ioClientRegister}
      columns={CLIENT_IOS_TABLE_COLUMNS}
      rows={rows}
      filterAccessors={CLIENT_IOS_FILTER_ACCESSORS}
    >
      <div className="space-y-4">
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <div className="flex w-full flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">{leading}</div>
              <OperationalTableControlsSlot contextLabel="Client IO register" />
            </div>
          }
        >
          <ClientIosTable
            rows={rows}
            selectedId={selected?.id ?? null}
            onView={handleView}
            isNavigating={isPending}
          />
        </OperationalTableSection>
        {isPending ? <Skeleton className="h-[320px] w-full" /> : null}
        {selected ? (
          <ClientIoForm
            key={selected.id}
            row={selected}
            recipients={recipientsByClientId[selected.client_id] ?? []}
            clientDefaultTermsText={selected.client_io_terms_text}
            brandName={selected.brand_name}
          />
        ) : null}
      </div>
    </OperationalTableSuiteProvider>
  );
}
