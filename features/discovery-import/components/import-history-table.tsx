"use client";

import type { ReactNode } from "react";
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
import {
  DiscoveryEmptyState,
  DiscoveryListCard,
  DiscoverySectionHeader,
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system";
import type { CreatorImportFileRow } from "@/features/discovery-import/types";
import { formatDiscoveryDate } from "@/lib/discovery/format-discovery-date";
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
    <div>
      <DiscoveryListCard
        className={cn(files.length > 0 && "mb-0 rounded-b-none")}
      >
        <DiscoverySectionHeader
          title="Upload history"
          description="Track uploaded files and processing outcomes."
          action={headerAction}
        />
      </DiscoveryListCard>

      {files.length === 0 ? (
        <DiscoveryListCard className="rounded-t-none">
          <DiscoveryEmptyState
            title="No imports yet"
            description="Upload agency lists, platform exports, or client spreadsheets to start building your import history."
            icon={FileSpreadsheetIcon}
          />
        </DiscoveryListCard>
      ) : (
        <DiscoverySuiteGrid
          cols="import"
          className="rounded-t-none"
          scrollerClassName="max-h-[420px] overflow-y-auto [scrollbar-color:rgb(226_232_240)_transparent] [scrollbar-width:thin]"
          header={
            <>
              <DiscoverySuiteCell>{null}</DiscoverySuiteCell>
              <DiscoverySuiteCell>Filename</DiscoverySuiteCell>
              <DiscoverySuiteCell>Source</DiscoverySuiteCell>
              <DiscoverySuiteCell>Status</DiscoverySuiteCell>
              <DiscoverySuiteCell>File type</DiscoverySuiteCell>
              <DiscoverySuiteCell align="end">Creators</DiscoverySuiteCell>
              <DiscoverySuiteCell align="end">Imported</DiscoverySuiteCell>
              <DiscoverySuiteCell align="end">Updated</DiscoverySuiteCell>
              <DiscoverySuiteCell align="end">Failed</DiscoverySuiteCell>
              <DiscoverySuiteCell>Created</DiscoverySuiteCell>
              <DiscoverySuiteCell align="end">Action</DiscoverySuiteCell>
            </>
          }
        >
          {files.map((file) => (
            <DiscoverySuiteRow key={file.id} bad={file.status === "failed"}>
              <DiscoverySuiteCell>
                <FileSpreadsheetIcon
                  className="size-4 text-[var(--tw-mut)]"
                  aria-hidden
                />
              </DiscoverySuiteCell>
              <DiscoverySuiteCell className="tw-nm">
                <span title={file.filename}>{file.filename}</span>
              </DiscoverySuiteCell>
              <DiscoverySuiteCell className="tw-t">
                {file.source_name?.trim() || "—"}
              </DiscoverySuiteCell>
              <DiscoverySuiteCell>
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
                        summary.duplicate
                          ? `${summary.duplicate} duplicates`
                          : null,
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
              </DiscoverySuiteCell>
              <DiscoverySuiteCell>
                <span className="tw-cc">{file.file_type}</span>
              </DiscoverySuiteCell>
              <DiscoverySuiteCell className="tw-v" align="end">
                {formatCount(file.total_creators)}
              </DiscoverySuiteCell>
              <DiscoverySuiteCell className="tw-v" align="end">
                {formatCount(file.imported_creators)}
              </DiscoverySuiteCell>
              <DiscoverySuiteCell className="tw-v" align="end">
                {formatCount(file.updated_creators)}
              </DiscoverySuiteCell>
              <DiscoverySuiteCell
                className={cn("tw-v", file.failed_creators > 0 && "neg")}
                align="end"
              >
                {file.failed_creators}
              </DiscoverySuiteCell>
              <DiscoverySuiteCell className="tw-d">
                {formatDiscoveryDate(file.created_at) || (
                  <span className="tw-miss">not set</span>
                )}
              </DiscoverySuiteCell>
              <DiscoverySuiteCell align="end">
                <div className="tw-act">
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
                    <span className="text-[10px] text-muted-foreground/60">
                      —
                    </span>
                  ) : null}
                </div>
              </DiscoverySuiteCell>
            </DiscoverySuiteRow>
          ))}
        </DiscoverySuiteGrid>
      )}
    </div>
  );
}
