"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { VendorIoForm } from "@/features/io/components/vendor-io-form";
import { VendorIosTable } from "@/features/io/components/vendor-ios-table";
import type { VendorIoRow } from "@/features/io/types";

type Props = {
  rows: VendorIoRow[];
  initialSelectedId: string | null;
};

export function VendorIosWorkspace({ rows, initialSelectedId }: Props) {
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
    <div className="space-y-4">
      <VendorIosTable
        rows={rows}
        selectedId={selected?.id ?? null}
        onView={handleView}
        isNavigating={isPending}
      />
      {isPending ? <Skeleton className="h-[320px] w-full" /> : null}
      {selected ? <VendorIoForm key={selected.id} row={selected} /> : null}
    </div>
  );
}

