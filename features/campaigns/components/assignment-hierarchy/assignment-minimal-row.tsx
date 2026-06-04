"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";

type AssignmentMinimalRowProps = {
  viewModel: AssignmentRowViewModel;
};

/** Stripped assignment row — no expansion, pills, or actions. */
export function AssignmentMinimalRow({ viewModel }: AssignmentMinimalRowProps) {
  const { group, rollups, displayName, opsStatusLabel } = viewModel;
  const line = group.line;

  return (
    <TableRow className="border-b border-border/25 text-[11px]">
      <TableCell className="min-w-[160px] px-2 py-2">
        <span className="font-medium">{displayName}</span>
        <p className="text-[10px] text-muted-foreground">
          <DocumentNumber value={line.document_number} />
        </p>
      </TableCell>
      <TableCell className="px-2 py-2 text-muted-foreground">
        {line.influencer_name ?? "—"}
      </TableCell>
      <TableCell className="px-2 py-2 text-right tabular-nums">
        {formatOperationalAmount(rollups.revenue)}
      </TableCell>
      <TableCell className="px-2 py-2 text-muted-foreground">{opsStatusLabel}</TableCell>
    </TableRow>
  );
}
