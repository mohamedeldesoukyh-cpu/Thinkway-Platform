"use client";

import type { ReactNode } from "react";
import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FinanceSuiteKpiStrip } from "@/components/finance/suite";
import { EntityPrevNext } from "@/components/navigation/entity-prev-next";
import { ListNavSync } from "@/components/navigation/list-nav-sync";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorIoForm } from "@/features/io/components/vendor-io-form";
import {
  VENDOR_IOS_TABLE_COLUMNS,
  VendorIosTable,
} from "@/features/io/components/vendor-ios-table";
import type { VendorIoRow } from "@/features/io/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { VENDOR_IOS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type Props = {
  rows: VendorIoRow[];
  initialSelectedId: string | null;
  leading?: ReactNode;
};

export function VendorIosWorkspace({ rows, initialSelectedId, leading }: Props) {
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

  const pendingSend = rows.filter(
    (row) => row.status === "draft" || row.status === "generated"
  ).length;
  const noInfluencer = rows.filter((row) => !row.influencer_name.trim()).length;
  const campaigns = new Set(rows.map((row) => row.campaign_header_id)).size;

  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.ioVendorRegister}
      columns={VENDOR_IOS_TABLE_COLUMNS}
      rows={rows}
      filterAccessors={VENDOR_IOS_FILTER_ACCESSORS}
    >
      <ListNavSync entity="vio" rows={rows} rowId={(row) => row.id} />
      <div className="space-y-4">
        <FinanceSuiteKpiStrip
          items={[
            {
              id: "ios",
              label: "Vendor IOs",
              value: String(rows.length),
              hint: `across ${campaigns} campaign${campaigns === 1 ? "" : "s"}`,
            },
            {
              id: "pending",
              label: "Pending send",
              value: String(pendingSend),
              hint: "never reached the creator",
              tone: pendingSend > 0 ? "bad" : undefined,
            },
            {
              id: "nolink",
              label: "No influencer linked",
              value: String(noInfluencer),
              hint: "IO exists, creator does not",
              tone: noInfluencer > 0 ? "bad" : undefined,
            },
            {
              id: "sent",
              label: "Sent / approved",
              value: String(rows.filter((row) => Boolean(row.sent_at || row.approved_at)).length),
              hint: "workflow, not payment",
            },
          ]}
        />
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <div className="flex w-full flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">{leading}</div>
              {selected ? (
                <EntityPrevNext
                  entity="vio"
                  currentId={selected.id}
                  hrefForId={(id) => `${pathname}?io=${encodeURIComponent(id)}`}
                />
              ) : null}
              <OperationalTableControlsSlot contextLabel="Vendor IO register" />
            </div>
          }
        >
          <VendorIosTable
            rows={rows}
            selectedId={selected?.id ?? null}
            onView={handleView}
            isNavigating={isPending}
          />
        </OperationalTableSection>
        {isPending ? <Skeleton className="h-[320px] w-full" /> : null}
        {selected ? <VendorIoForm key={selected.id} row={selected} /> : null}
      </div>
    </OperationalTableSuiteProvider>
  );
}
