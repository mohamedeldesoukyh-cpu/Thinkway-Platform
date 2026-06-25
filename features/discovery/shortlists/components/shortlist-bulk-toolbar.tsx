"use client";

import {
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  selectedCount: number;
  showSubmit: boolean;
  showStatusActions: boolean;
  showMove: boolean;
  busy?: boolean;
  onSubmitSelected: () => void;
  onRemoveSelected: () => void;
  onCompareSelected: () => void;
  onExportSelected: () => void;
  onMoveSelected: () => void;
  onGenerateQuotation: () => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onCancelSelected: () => void;
  onClearSelection: () => void;
};

export function ShortlistBulkToolbar({
  selectedCount,
  showSubmit,
  showStatusActions,
  showMove,
  busy,
  onSubmitSelected,
  onRemoveSelected,
  onCompareSelected,
  onExportSelected,
  onMoveSelected,
  onGenerateQuotation,
  onApproveSelected,
  onRejectSelected,
  onCancelSelected,
  onClearSelection,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 -mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 backdrop-blur-sm">
      <span className="text-xs font-semibold text-primary">
        {selectedCount} selected
      </span>
      <div className="hidden h-4 w-px bg-primary/25 sm:block" aria-hidden />

      {showSubmit ? (
        <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs" onClick={onSubmitSelected} disabled={busy}>
          <SendIcon className="size-3.5" />
          Submit selected
        </Button>
      ) : null}

      {showStatusActions ? (
        <>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onApproveSelected} disabled={busy}>
            <CheckIcon className="size-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onRejectSelected} disabled={busy}>
            Reject
          </Button>
        </>
      ) : null}

      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onRemoveSelected} disabled={busy}>
        <Trash2Icon className="size-3.5" />
        Remove
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onCompareSelected} disabled={busy}>
        <GitCompareArrowsIcon className="size-3.5" />
        Compare
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onExportSelected} disabled={busy}>
        <DownloadIcon className="size-3.5" />
        Export
      </Button>
      {showMove ? (
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onMoveSelected} disabled={busy}>
          Move to campaign
        </Button>
      ) : null}
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onGenerateQuotation} disabled={busy}>
        <FileTextIcon className="size-3.5" />
        Generate quotation
      </Button>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onCancelSelected} disabled={busy}>
        Cancel selected
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-8 gap-1 text-xs text-muted-foreground"
        onClick={onClearSelection}
        disabled={busy}
      >
        <XIcon className="size-3.5" />
        Clear selection
      </Button>
    </div>
  );
}
