"use client";

import {
  DownloadIcon,
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
  busy?: boolean;
};

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
  busy,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#0057FF]/20 bg-[#EEF4FF] px-4 py-2 md:px-5">
      <span className="text-[12px] font-semibold text-[#0057FF]">
        {selectedCount} selected
      </span>
      <div className="h-4 w-px bg-[#0057FF]/25" aria-hidden />
      <Select value={selectedShortlist} onValueChange={onShortlistChange}>
        <SelectTrigger className="h-8 w-[160px] border-[#E6EAF2] bg-white text-xs">
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
      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAiMatch}>
        <SparklesIcon className="size-3.5" />
        AI Match
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto h-8 gap-1 text-xs text-[#5B6575]"
        onClick={onClearSelection}
      >
        <XIcon className="size-3.5" />
        Clear
      </Button>
    </div>
  );
}
