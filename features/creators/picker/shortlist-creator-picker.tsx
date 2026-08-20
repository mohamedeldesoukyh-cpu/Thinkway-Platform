"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addCreatorsToShortlistByProfileUrls } from "@/features/discovery/shortlists/actions";
import { ShortlistPasteLinksPanel } from "@/features/discovery/shortlists/components/shortlist-paste-links-panel";
import {
  describeShortlistPasteAddOutcome,
  looksLikePastedProfileList,
} from "@/features/discovery/shortlists/paste-links-policy";
import { parseProfileInputList } from "@/lib/social/parse-profile-url";
import { cn } from "@/lib/utils";

import {
  addUnifiedCreatorsToShortlist,
  describeAddOutcome,
  isAddableCreator,
} from "@/features/discovery/shortlists/add-to-shortlist-client";

import {
  CreatorPickerDialog,
  existingKeysFromShortlistItems,
} from "./creator-picker-dialog";
import type { ExistingCreatorKey } from "./creator-selection-types";

type AddCreatorsMode = "search" | "paste";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  existingItems: ExistingCreatorKey[];
  onAdded: () => void;
  initialMode?: AddCreatorsMode;
};

export function ShortlistCreatorPicker({
  open,
  onOpenChange,
  shortlistId,
  existingItems,
  onAdded,
  initialMode = "search",
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isPasting, startPasteTransition] = useTransition();
  const [mode, setMode] = useState<AddCreatorsMode>(initialMode);
  const [pasteRaw, setPasteRaw] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const existingKeys = existingKeysFromShortlistItems(existingItems);

  const pastePreview = useMemo(
    () => parseProfileInputList(pasteRaw),
    [pasteRaw]
  );
  const pasteCount = pastePreview.parsed.length;

  useEffect(() => {
    if (!open) {
      setMode("search");
      setPasteRaw("");
      setPasteError(null);
      return;
    }
    setMode(initialMode);
  }, [open, initialMode]);

  function handleConfirm(
    creators: Parameters<typeof addUnifiedCreatorsToShortlist>[1]
  ) {
    if (creators.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await addUnifiedCreatorsToShortlist(shortlistId, creators);
        if (outcome.added > 0) {
          toast.success(describeAddOutcome(outcome));
        } else if (outcome.failed > 0) {
          toast.error(outcome.firstError ?? "Failed to add creators");
        } else {
          toast.info(describeAddOutcome(outcome));
        }
        onAdded();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add creators");
      }
    });
  }

  function handlePaste() {
    const trimmed = pasteRaw.trim();
    if (parseProfileInputList(trimmed).parsed.length === 0) {
      setPasteError(
        "Paste Instagram, TikTok, YouTube, Snapchat, Facebook, or X profile links."
      );
      return;
    }
    setPasteError(null);
    startPasteTransition(async () => {
      const result = await addCreatorsToShortlistByProfileUrls({
        shortlistId,
        raw: trimmed,
      });
      if (!result.ok && result.added === 0) {
        setPasteError(result.message);
        toast.error(result.message);
        return;
      }

      const summary = describeShortlistPasteAddOutcome(result);
      if (result.added > 0) {
        toast.success(summary);
      } else if (result.alreadyOnList > 0 && result.failed === 0) {
        toast.info(summary);
      } else {
        toast.error(summary);
      }

      onAdded();
      if (result.failed === 0 && result.invalid === 0) {
        onOpenChange(false);
      }
    });
  }

  const sourceTabs = (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-0.5">
      {(
        [
          { id: "search", label: "Search" },
          { id: "paste", label: "Paste links" },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => {
            setMode(option.id);
            setPasteError(null);
          }}
          className={cn(
            "h-8 rounded-md text-xs font-semibold transition-colors",
            mode === option.id
              ? "bg-white text-[#2563eb] shadow-[0_1px_3px_rgba(37,99,235,0.12)]"
              : "bg-transparent text-[#64748b] hover:text-[#0f172a]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <CreatorPickerDialog
      open={open}
      onOpenChange={onOpenChange}
      container="sheet"
      panelLayout
      title="Add creators"
      description={
        mode === "paste"
          ? "Paste a full list of profile links. Creators already in Discovery are added; missing ones are created, then added."
          : "Search internal, imported, and discovered creators, or paste a list of profile links."
      }
      selectionMode="multi"
      productionOnly
      existingKeys={existingKeys}
      isRowDisabled={(creator) => !isAddableCreator(creator)}
      onConfirm={handleConfirm}
      onConfirmPending={isPending || isPasting}
      headerExtra={sourceTabs}
      bodyOverride={
        mode === "paste" ? (
          <ShortlistPasteLinksPanel
            value={pasteRaw}
            onChange={(value) => {
              setPasteRaw(value);
              if (pasteError) setPasteError(null);
            }}
            error={pasteError}
            pending={isPasting}
          />
        ) : undefined
      }
      footer={
        mode === "paste" ? (
          <Button
            onClick={handlePaste}
            disabled={isPasting || pasteCount === 0}
            className="creator-picker-add-btn relative h-9 flex-1 overflow-hidden rounded-lg border-0 bg-gradient-to-br from-blue-600 to-indigo-600 text-[13px] font-bold tracking-tight text-white shadow-[0_2px_12px_rgba(37,99,235,0.3)] hover:brightness-110 hover:shadow-[0_4px_20px_rgba(37,99,235,0.45)] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            {isPasting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {pasteCount > 0
              ? `Add ${pasteCount} creator${pasteCount === 1 ? "" : "s"} to shortlist`
              : "Add to shortlist"}
          </Button>
        ) : undefined
      }
      onSearchInput={(value) => {
        if (!looksLikePastedProfileList(value)) return false;
        setMode("paste");
        setPasteRaw(value);
        setPasteError(null);
        return true;
      }}
    />
  );
}
