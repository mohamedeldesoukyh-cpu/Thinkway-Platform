"use client";

import type { ReactNode } from "react";

import { OperationalTableControls } from "@/components/tables/operational-table-controls";

type OperationalTableToolbarProps = {
  contextLabel: string;
  children?: ReactNode;
};

export function OperationalTableToolbar({
  contextLabel,
  children,
}: OperationalTableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children ? <div className="min-w-0 flex-1 sm:flex-none">{children}</div> : null}
      <OperationalTableControls contextLabel={contextLabel} />
    </div>
  );
}
