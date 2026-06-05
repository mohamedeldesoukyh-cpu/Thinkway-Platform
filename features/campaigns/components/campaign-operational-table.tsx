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
      className={cn(OPERATIONAL_TABLE_FONT, OPERATIONAL_TABLE_SURFACE, className)}
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
      className={cn(
        "sticky top-0 z-20 border-b border-border/50",
        OPERATIONAL_TABLE_HEADER_SURFACE,
        "[&_th]:h-auto [&_th]:align-middle [&_th]:py-2 [&_th]:font-semibold",
        className
      )}
      {...props}
    />
  );
}

export function CampaignOperationalTableHead({
  className,
  ...props
}: ComponentProps<typeof TableHead>) {
  return <TableHead className={cn("px-1.5", OPERATIONAL_TABLE_HEADER_CELL, className)} {...props} />;
}

/** Alternating row backgrounds for scanability (white / light grey). */
export const OPERATIONAL_TABLE_ZEBRA_BODY =
  "[&_tr:nth-child(odd)]:bg-card [&_tr:nth-child(even)]:bg-muted/30";

export function CampaignOperationalTableBody({
  className,
  ...props
}: ComponentProps<typeof TableBody>) {
  return (
    <TableBody className={cn(OPERATIONAL_TABLE_ZEBRA_BODY, className)} {...props} />
  );
}

export function CampaignOperationalTableRow({
  className,
  ...props
}: ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        "border-b border-border/25 bg-inherit text-[11px] font-normal hover:bg-muted/45",
        className
      )}
      {...props}
    />
  );
}

export function CampaignOperationalTableCell({
  className,
  ...props
}: ComponentProps<typeof TableCell>) {
  return (
    <TableCell
      className={cn("px-1.5 py-1.5 text-[11px] font-normal align-middle", className)}
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
      className={cn("text-[11px] tabular-nums text-muted-foreground", className)}
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
