"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import { ClientIosTable } from "@/features/io/components/client-ios-table";
import type { ClientIoRow } from "@/features/io/types";

type Props = {
  rows: ClientIoRow[];
  initialSelectedId: string | null;
};

export function ClientIosWorkspace({ rows, initialSelectedId }: Props) {
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
      <ClientIosTable
        rows={rows}
        selectedId={selected?.id ?? null}
        onView={handleView}
        isNavigating={isPending}
      />
      {isPending ? <Skeleton className="h-[320px] w-full" /> : null}
      {selected ? <ClientIoForm key={selected.id} row={selected} /> : null}
    </div>
  );
}

