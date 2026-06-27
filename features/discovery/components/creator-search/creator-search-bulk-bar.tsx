"use client";

import {
  DownloadIcon,
  FileTextIcon,
  GitCompareArrowsIcon,
  ListPlusIcon,
  Share2Icon,
  SparklesIcon,
} from "lucide-react";

import {
  GlassSelectionFlyout,
  type GlassFlyoutAction,
} from "@/components/shared/navigation/glass-selection-flyout";
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
  const actions: GlassFlyoutAction[] = [
    {
      id: "add",
      label: "Add to list",
      icon: ListPlusIcon,
      variant: "primary",
      disabled: busy || !selectedShortlist,
      onClick: onAddToList,
    },
    {
      id: "compare",
      label: "Compare",
      icon: GitCompareArrowsIcon,
      variant: "outline",
      onClick: onCompare,
    },
    {
      id: "export",
      label: "Export",
      icon: DownloadIcon,
      variant: "outline",
      onClick: onExport,
    },
    {
      id: "share",
      label: "Share",
      icon: Share2Icon,
      variant: "outline",
      onClick: onShare,
    },
    {
      id: "quotation",
      label: "Generate quotation",
      icon: FileTextIcon,
      variant: "outline",
      disabled: busy,
      onClick: onGenerateQuotation,
    },
    {
      id: "ai-match",
      label: "AI Match",
      icon: SparklesIcon,
      variant: "outline",
      onClick: onAiMatch,
    },
  ];

  const hasStats =
    estFollowers != null || estReach != null || estEngagement != null;

  return (
    <GlassSelectionFlyout
      open={selectedCount > 0}
      selectedCount={selectedCount}
      entityLabel="creator"
      actions={actions}
      onClearSelection={onClearSelection}
      busy={busy}
      maxVisibleActions={2}
    >
      {hasStats ? (
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
          {estFollowers != null && <>{compact(estFollowers)} followers </>}
          {estReach != null && <>· {compact(estReach)} est. reach </>}
          {estEngagement != null && <>· {estEngagement.toFixed(1)}% avg ER</>}
        </span>
      ) : null}
      <Select value={selectedShortlist} onValueChange={onShortlistChange}>
        <SelectTrigger className="h-7 w-[140px] border-border/60 bg-background/60 text-xs">
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
        type="button"
        size="xs"
        variant="outline"
        className="h-7 shrink-0 rounded-full text-xs sm:hidden"
        disabled={busy || !selectedShortlist}
        onClick={onAddToList}
      >
        <ListPlusIcon className="size-3" />
        Add
      </Button>
    </GlassSelectionFlyout>
  );
}
