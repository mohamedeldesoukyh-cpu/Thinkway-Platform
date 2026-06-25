"use client";

import {
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  ListPlusIcon,
  Share2Icon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  selectedCount: number;
  shortlists: Array<{ id: string; name: string }>;
  selectedShortlist: string;
  onShortlistChange: (id: string) => void;
  onClearSelection: () => void;
  onAddToList: () => void;
  onCompare: () => void;
  onExport: () => void;
  onShare: () => void;
  onAiMatch: () => void;
  onGenerateQuotation: () => void;
  /** Quick stats computed from the current selection (spec §1). */
  estFollowers?: number;
  estReach?: number;
  estEngagement?: number;
  busy?: boolean;
};

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0
  );
}

export function CreatorSearchBulkBar({
  selectedCount,
  shortlists,
  selectedShortlist,
  onShortlistChange,
  onClearSelection,
  onAddToList,
  onCompare,
  onExport,
  onShare,
  onAiMatch,
  onGenerateQuotation,
  estFollowers,
  estReach,
  estEngagement,
  busy,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2 md:px-5">
      <span className="text-[12px] font-semibold text-primary">
        {selectedCount} selected
      </span>
      {(estFollowers != null || estReach != null || estEngagement != null) && (
        <span className="text-[11px] text-muted-foreground">
          {estFollowers != null && <>· {compact(estFollowers)} followers </>}
          {estReach != null && <>· {compact(estReach)} est. reach </>}
          {estEngagement != null && <>· {estEngagement.toFixed(1)}% avg ER</>}
        </span>
      )}
      <div className="h-4 w-px bg-primary/25" aria-hidden />
      <Select value={selectedShortlist} onValueChange={onShortlistChange}>
        <SelectTrigger className="h-8 w-[160px] border-border bg-card text-xs">
          <SelectValue placeholder="Target list" />
        </SelectTrigger>
        <SelectContent>
          {shortlists.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="secondary"
        className="h-8 gap-1.5 text-xs"
        onClick={onAddToList}
        disabled={busy || !selectedShortlist}
      >
        <ListPlusIcon className="size-3.5" />
        Add to List
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onCompare}>
        <GitCompareArrowsIcon className="size-3.5" />
        Compare
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onExport}>
        <DownloadIcon className="size-3.5" />
        Export
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onShare}>
        <Share2Icon className="size-3.5" />
        Share
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={onGenerateQuotation}
        disabled={busy}
      >
        <FileTextIcon className="size-3.5" />
        Generate Quotation
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAiMatch}>
        <SparklesIcon className="size-3.5" />
        AI Match
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-8 gap-1 text-xs text-muted-foreground"
        onClick={onClearSelection}
      >
        <XIcon className="size-3.5" />
        Clear
      </Button>
    </div>
  );
}
