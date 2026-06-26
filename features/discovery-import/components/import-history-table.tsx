"use client";

import { format } from "date-fns";
import { FileSpreadsheetIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImportStatusBadge } from "@/features/discovery-import/components/import-status-badge";
import type { CreatorImportFileRow } from "@/features/discovery-import/types";

type ImportHistoryTableProps = {
  files: CreatorImportFileRow[];
};

export function ImportHistoryTable({ files }: ImportHistoryTableProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileSpreadsheetIcon className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">No imports yet</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Upload agency lists, platform exports, or client spreadsheets to start building your
            import history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>File type</TableHead>
            <TableHead className="text-right">Total creators</TableHead>
            <TableHead className="text-right">Imported</TableHead>
            <TableHead className="text-right">Updated</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead>Created date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell className="max-w-[220px] truncate font-medium">{file.filename}</TableCell>
              <TableCell className="text-muted-foreground">
                {file.source_name?.trim() || "—"}
              </TableCell>
              <TableCell>
                <ImportStatusBadge status={file.status} />
              </TableCell>
              <TableCell className="uppercase text-muted-foreground">{file.file_type}</TableCell>
              <TableCell className="text-right tabular-nums">{file.total_creators}</TableCell>
              <TableCell className="text-right tabular-nums">{file.imported_creators}</TableCell>
              <TableCell className="text-right tabular-nums">{file.updated_creators}</TableCell>
              <TableCell className="text-right tabular-nums text-destructive">
                {file.failed_creators}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(file.created_at), "MMM d, yyyy HH:mm")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
