"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { FileSpreadsheetIcon } from "lucide-react";

import { CancelImportButton } from "@/features/discovery-import/components/cancel-import-button";
import { PauseImportButton } from "@/features/discovery-import/components/pause-import-button";
import { ResumeImportButton } from "@/features/discovery-import/components/resume-import-button";
import { ImportStatusBadge } from "@/features/discovery-import/components/import-status-badge";
import {
  isCancellableCreatorImportStatus,
  isPausableCreatorImportStatus,
  isResumableCreatorImportStatus,
} from "@/features/discovery-import/import-status";
import type { CreatorImportFileRow } from "@/features/discovery-import/types";
import { cn } from "@/lib/utils";

type ImportHistoryTableProps = {
  files: CreatorImportFileRow[];
  headerAction?: ReactNode;
  onImportAction?: () => void | Promise<void>;
};
function formatCount(value: number): string {
  return value > 0 ? String(value) : "—";
}

export function ImportHistoryTable({
  files,
  headerAction,
  onImportAction,
}: ImportHistoryTableProps) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-[13px] font-bold text-foreground">Upload history</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Track uploaded files and processing outcomes.
          </p>
        </div>
        {headerAction}
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
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
      ) : (
        <div className="max-h-[420px] overflow-y-auto [scrollbar-color:rgb(226_232_240)_transparent] [scrollbar-width:thin]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <tr>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-left text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Filename
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-left text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Source
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-left text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Status
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-left text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  File type
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-right text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Total creators
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-right text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Imported
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-right text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Updated
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-right text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Failed
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-left text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Created date
                </th>
                <th className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-right text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="transition-colors hover:bg-muted/40"
                >
                  <td className="max-w-[220px] truncate border-b border-border px-3.5 py-2.5 text-xs font-medium text-foreground">
                    {file.filename}
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5 text-xs text-muted-foreground">
                    {file.source_name?.trim() || "—"}
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5">
                    <ImportStatusBadge status={file.status} />
                    {file.status === "completed" &&
                    file.processing_log &&
                    typeof file.processing_log === "object" &&
                    "summary" in file.processing_log ? (
                      <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-muted-foreground">
                        {(() => {
                          const summary = (
                            file.processing_log as {
                              summary?: {
                                skipped?: number;
                                duplicate?: number;
                                avatars_imported?: number;
                                missing_avatars?: number;
                                duration_ms?: number;
                              };
                            }
                          ).summary;
                          if (!summary) return null;
                          const parts = [
                            summary.skipped ? `${summary.skipped} skipped` : null,
                            summary.duplicate ? `${summary.duplicate} duplicates` : null,
                            summary.avatars_imported != null
                              ? `${summary.avatars_imported} avatars`
                              : null,
                            summary.missing_avatars
                              ? `${summary.missing_avatars} missing avatars`
                              : null,
                          ].filter(Boolean);
                          return parts.length > 0 ? parts.join(" · ") : null;
                        })()}
                      </p>
                    ) : null}
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5 text-xs font-medium text-blue-600 uppercase dark:text-blue-400">
                    {file.file_type}
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {formatCount(file.total_creators)}
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {formatCount(file.imported_creators)}
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {formatCount(file.updated_creators)}
                  </td>
                  <td
                    className={cn(
                      "border-b border-border px-3.5 py-2.5 text-right text-xs tabular-nums",
                      file.failed_creators > 0
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {file.failed_creators}
                  </td>
                  <td className="whitespace-nowrap border-b border-border px-3.5 py-2.5 text-[11px] text-muted-foreground">
                    {format(new Date(file.created_at), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="border-b border-border px-3.5 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isResumableCreatorImportStatus(file.status) ? (
                        <ResumeImportButton
                          importFileId={file.id}
                          onResumed={onImportAction}
                        />
                      ) : null}
                      {isPausableCreatorImportStatus(file.status) ? (
                        <PauseImportButton
                          importFileId={file.id}
                          onPaused={onImportAction}
                        />
                      ) : null}
                      {isCancellableCreatorImportStatus(file.status) ? (
                        <CancelImportButton
                          importFileId={file.id}
                          filename={file.filename}
                          onCancelled={onImportAction}
                        />
                      ) : null}
                      {!isResumableCreatorImportStatus(file.status) &&
                      !isPausableCreatorImportStatus(file.status) &&
                      !isCancellableCreatorImportStatus(file.status) ? (
                        <span className="text-[10px] text-muted-foreground/60">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
