"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { FileSpreadsheetIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CancelImportButton } from "@/features/discovery-import/components/cancel-import-button";
import { PauseImportButton } from "@/features/discovery-import/components/pause-import-button";
import { ResumeImportButton } from "@/features/discovery-import/components/resume-import-button";
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
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "@/features/discovery/components/design-system/discovery-suite-cols";
import type { CreatorImportFileRow } from "@/features/discovery-import/types";
import { formatDiscoveryDateTime } from "@/lib/discovery/format-discovery-date";
import { cn } from "@/lib/utils";
import { sumImportHistoryTotals } from "@/features/discovery-import/sum-import-history-totals";

export { sumImportHistoryTotals } from "@/features/discovery-import/sum-import-history-totals";

type ImportHistoryTableProps = {
  files: CreatorImportFileRow[];
  headerAction?: ReactNode;
  onImportAction?: () => void | Promise<void>;
};

const IMPORT_MIN_W = DISCOVERY_GRID_MIN_W.import ?? 1340;

function statusPill(status: CreatorImportFileRow["status"]): {
  label: string;
  tone: "p-g" | "p-y" | "p-r";
} {
  if (status === "completed") return { label: "Completed", tone: "p-g" };
  if (status === "failed") return { label: "Failed", tone: "p-r" };
  if (status === "paused") return { label: "Paused", tone: "p-y" };
  return { label: "Processing", tone: "p-y" };
}

function isBadRow(file: CreatorImportFileRow): boolean {
  return file.failed_creators > 0 || file.status === "failed";
}

function isWarnRow(file: CreatorImportFileRow): boolean {
  return (
    !isBadRow(file) &&
    (file.status === "processing" ||
      file.status === "queued" ||
      file.status === "uploaded")
  );
}

function CountCell({
  value,
  tone,
}: {
  value: number;
  tone?: "pos" | "neg";
}) {
  const zero = value === 0;
  const className =
    tone === "pos"
      ? "tw-v pos"
      : tone === "neg"
        ? cn("tw-v", zero ? "z" : "neg")
        : cn("tw-v", zero && "z");
  return (
    <DiscoverySuiteCell className={className} align="end">
      {value.toLocaleString("en-US")}
    </DiscoverySuiteCell>
  );
}

export function ImportHistoryTable({
  files,
  headerAction,
  onImportAction,
}: ImportHistoryTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const totals = useMemo(() => sumImportHistoryTotals(files), [files]);

  const allSelected =
    files.length > 0 && files.every((file) => selectedIds.has(file.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(files.map((file) => file.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRetry(file: CreatorImportFileRow) {
    toast.message(
      `Re-upload “${file.filename}” from the drop zone to retry. Source files are removed after import.`
    );
  }

  function handleView(file: CreatorImportFileRow) {
    const parts = [
      `${file.total_creators.toLocaleString("en-US")} creators`,
      `${file.imported_creators.toLocaleString("en-US")} imported`,
      `${file.updated_creators.toLocaleString("en-US")} updated`,
      `${file.failed_creators.toLocaleString("en-US")} failed`,
    ];
    toast.message(file.filename, { description: parts.join(" · ") });
  }

  const header = (
    <>
      <DiscoverySuiteCell>
        <input
          type="checkbox"
          className="tw-ck"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={toggleSelectAll}
          aria-label="Select all"
        />
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Filename</DiscoverySuiteCell>
      <DiscoverySuiteCell>Source</DiscoverySuiteCell>
      <DiscoverySuiteCell>Status</DiscoverySuiteCell>
      <DiscoverySuiteCell>Type</DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Creators
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Imported
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Updated
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Failed
      </DiscoverySuiteCell>
      <DiscoverySuiteCell>Created</DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-rr" align="end">
        Act
      </DiscoverySuiteCell>
    </>
  );

  const footer = (
    <>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
      <DiscoverySuiteCell className="tw-v" align="end">
        {totals.creators.toLocaleString("en-US")}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-v pos" align="end">
        {totals.imported.toLocaleString("en-US")}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-v" align="end">
        {totals.updated.toLocaleString("en-US")}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell className="tw-v neg" align="end">
        {totals.failed.toLocaleString("en-US")}
      </DiscoverySuiteCell>
      <DiscoverySuiteCell />
      <DiscoverySuiteCell />
    </>
  );

  const conflictNote =
    totals.failed > 0 || totals.failedFiles > 0
      ? `${totals.failed.toLocaleString("en-US")} creators failed to import${
          totals.failedFiles > 0
            ? ` and ${totals.failedFiles} file${
                totals.failedFiles === 1 ? "" : "s"
              } failed outright`
            : ""
        }.`
      : null;

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
        <>
          <DiscoverySuiteGrid
            cols="import"
            minWidth={IMPORT_MIN_W}
            className="rounded-t-none"
            scrollerClassName="max-h-[420px] overflow-y-auto [scrollbar-color:rgb(226_232_240)_transparent] [scrollbar-width:thin]"
            header={header}
            footer={footer}
          >
            {files.map((file) => {
              const bad = isBadRow(file);
              const warn = isWarnRow(file);
              const pill = statusPill(file.status);
              const source = file.source_name?.trim() ?? "";
              const typeLabel = file.file_type?.toUpperCase() || "—";
              return (
                <DiscoverySuiteRow
                  key={file.id}
                  selected={selectedIds.has(file.id)}
                  bad={bad}
                  warn={warn}
                >
                  <DiscoverySuiteCell>
                    <input
                      type="checkbox"
                      className="tw-ck"
                      checked={selectedIds.has(file.id)}
                      onChange={() => toggleSelect(file.id)}
                      aria-label={`Select ${file.filename}`}
                    />
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    <span className="tw-nm" title={file.filename}>
                      {file.filename}
                    </span>
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    {source ? (
                      <span className="tw-t">{source}</span>
                    ) : (
                      <span className="tw-miss">not tagged</span>
                    )}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    <span className={cn("tw-p", pill.tone)}>{pill.label}</span>
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell>
                    <span className="tw-cc">{typeLabel}</span>
                  </DiscoverySuiteCell>
                  <CountCell value={file.total_creators} />
                  <CountCell value={file.imported_creators} tone="pos" />
                  <CountCell value={file.updated_creators} />
                  <CountCell value={file.failed_creators} tone="neg" />
                  <DiscoverySuiteCell className="tw-d">
                    {formatDiscoveryDateTime(file.created_at) || (
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
                      {bad && !isResumableCreatorImportStatus(file.status) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] font-bold"
                          onClick={() => handleRetry(file)}
                        >
                          Retry
                        </Button>
                      ) : null}
                      {!bad &&
                      !isResumableCreatorImportStatus(file.status) &&
                      !isPausableCreatorImportStatus(file.status) &&
                      !isCancellableCreatorImportStatus(file.status) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] font-bold"
                          onClick={() => handleView(file)}
                        >
                          View
                        </Button>
                      ) : null}
                    </div>
                  </DiscoverySuiteCell>
                </DiscoverySuiteRow>
              );
            })}
          </DiscoverySuiteGrid>
          {conflictNote ? (
            <p className="tw-note wrn">{conflictNote}</p>
          ) : null}
          <span className="sr-only" aria-hidden>
            {DISCOVERY_COLS.import}
          </span>
        </>
      )}
    </div>
  );
}
