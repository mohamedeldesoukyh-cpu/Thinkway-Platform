"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_TABLE_FONT,
  OPERATIONAL_TABLE_HEADER_CELL,
  OPERATIONAL_TABLE_HEADER_ROW,
  OPERATIONAL_TABLE_HEADER_SURFACE,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import {
  documentNumberDisplayTitle,
  formatDocumentNumberForDisplay,
} from "@/lib/documents/format-document-number";
import { cn } from "@/lib/utils";

function formatMonoCellChildren(children: ReactNode): {
  content: ReactNode;
  title?: string;
} {
  if (typeof children === "string") {
    const display = formatDocumentNumberForDisplay(children);
    return {
      content: display,
      title: documentNumberDisplayTitle(children),
    };
  }
  if (typeof children === "number") {
    const raw = String(children);
    const display = formatDocumentNumberForDisplay(raw);
    return {
      content: display,
      title: documentNumberDisplayTitle(raw),
    };
  }
  return { content: children };
}

export {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_TABLE_FONT,
  OPERATIONAL_TABLE_HEADER_CELL,
  OPERATIONAL_TABLE_HEADER_ROW,
  OPERATIONAL_TABLE_HEADER_SURFACE,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";

type TableProps = ComponentProps<typeof Table>;

export function CampaignOperationalTable({ className, ...props }: TableProps) {
  return (
    <Table
      variant="flush"
      className={cn(
        "thinkway-campaign-data-table",
        OPERATIONAL_TABLE_FONT,
        OPERATIONAL_TABLE_SURFACE,
        className
      )}
      {...props}
    />
  );
}

export function CampaignOperationalTableHeader({
  className,
  ...props
}: ComponentProps<typeof TableHeader>) {
  return (
    <TableHeader
      className={cn("thinkway-campaign-op-table-header", OPERATIONAL_TABLE_HEADER_SURFACE, className)}
      {...props}
    />
  );
}

export function CampaignOperationalTableHead({
  className,
  ...props
}: ComponentProps<typeof TableHead>) {
  return (
    <TableHead className={cn("thinkway-campaign-op-table-head", OPERATIONAL_TABLE_HEADER_CELL, className)} {...props} />
  );
}

export function CampaignOperationalTableBody({
  className,
  ...props
}: ComponentProps<typeof TableBody>) {
  return (
    <TableBody className={cn("thinkway-campaign-op-table-body", className)} {...props} />
  );
}

export function CampaignOperationalTableRow({
  className,
  ...props
}: ComponentProps<typeof TableRow>) {
  return (
    <TableRow className={cn("thinkway-campaign-op-table-row", className)} {...props} />
  );
}

export function CampaignOperationalTableCell({
  className,
  ...props
}: ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={cn("thinkway-campaign-op-table-cell", className)}
      {...props}
    />
  );
}

export function CampaignOperationalTableCellMono({
  className,
  children,
  title,
  ...props
}: ComponentProps<typeof TableCell>) {
  const formatted = formatMonoCellChildren(children);
  return (
    <CampaignOperationalTableCell
      className={cn("tabular-nums", className)}
      title={title ?? formatted.title}
      {...props}
    >
      {formatted.content}
    </CampaignOperationalTableCell>
  );
}

export function CampaignOperationalTableCellAmount({
  className,
  ...props
}: ComponentProps<typeof TableCell>) {
  return (
    <CampaignOperationalTableCell
      className={cn("text-right tabular-nums", OPERATIONAL_AMOUNT_CLASS, className)}
      {...props}
    />
  );
}

/** Header row inside CampaignOperationalTableHeader */
export function CampaignOperationalTableHeaderRow({
  className,
  ...props
}: ComponentProps<typeof TableRow>) {
  return <TableRow className={cn(OPERATIONAL_TABLE_HEADER_ROW, className)} {...props} />;
}
