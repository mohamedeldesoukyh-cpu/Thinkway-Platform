"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  GitCompareArrowsIcon,
  ListPlusIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CreatorDetailSheet } from "@/features/campaigns/components/creator-detail-sheet";
import {
  addUnifiedCreatorsToShortlists,
  describeAddOutcome,
} from "@/features/discovery/shortlists/add-to-shortlist-client";
import { AddToShortlistDialog } from "@/features/discovery/shortlists/components/add-to-shortlist-dialog";
import { loadCreatorCompareBundleAction } from "@/features/discovery/actions/creator-compare-actions";
import type { CreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorCompareMatrix } from "./creator-compare-matrix";
import {
  readCompareQueue,
  writeCompareQueue,
} from "./compare-storage";

type Props = {
  shortlists: Array<{ id: string; name: string }>;
};

export function CreatorCompareWorkspace({ shortlists: initialShortlists }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shortlists, setShortlists] = useState(initialShortlists);
  const [bundle, setBundle] = useState<CreatorCompareBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailCreator, setDetailCreator] = useState<UnifiedCreatorResult | null>(null);
  const [addToShortlistOpen, setAddToShortlistOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const creators = useMemo(
    () => bundle?.entries.map((e) => e.creator) ?? [],
    [bundle]
  );

  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      const fromStorage = readCompareQueue();
      const idsParam = searchParams.get("ids");
      const idsFromUrl = idsParam
        ? idsParam.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const seedIds =
        idsFromUrl.length >= 2
          ? idsFromUrl.slice(0, MAX_CREATOR_COMPARE)
          : fromStorage.map((c) => c.unified_id);

      if (seedIds.length < 2) {
        setBundle({ entries: [] });
        setLoading(false);
        return;
      }

      const loaded = await loadCreatorCompareBundleAction(seedIds);
      setBundle(loaded);
      writeCompareQueue(loaded.entries.map((e) => e.creator));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load comparison");
      setBundle({ entries: [] });
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function handleRemove(unifiedId: string) {
    setBundle((prev) => {
      if (!prev) return prev;
      const nextEntries = prev.entries.filter((e) => e.creator.unified_id !== unifiedId);
      writeCompareQueue(nextEntries.map((e) => e.creator));
      if (nextEntries.length < 2) {
        router.push("/discovery/search");
      }
      return { entries: nextEntries };
    });
  }

  function handleOpenCreator(unifiedId: string) {
    const creator = creators.find((c) => c.unified_id === unifiedId) ?? null;
    setDetailCreator(creator);
  }

  function handleAddToShortlistConfirm({ shortlistIds }: { shortlistIds: string[] }) {
    if (creators.length === 0) {
      toast.error("No creators to add.");
      return;
    }
    startTransition(async () => {
      try {
        const outcome = await addUnifiedCreatorsToShortlists(shortlistIds, creators);
        if (outcome.added > 0) {
          toast.success(describeAddOutcome(outcome));
        } else if (outcome.failed > 0) {
          toast.error(outcome.firstError ?? "Failed to add to list");
        } else if (outcome.ineligible > 0 && outcome.alreadyOnList === 0) {
          toast.error("Compared creators cannot be added to discovery lists.");
        } else {
          toast.info(describeAddOutcome(outcome));
        }
        setAddToShortlistOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add to list");
      }
    });
  }

  async function exportPdf() {
    if (creators.length < 2) return;
    setExporting(true);
    try {
      const res = await fetch("/api/discovery/compare/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unifiedIds: creators.map((c) => c.unified_id) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "PDF export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `thinkway-creator-compare-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Comparison exported as PDF");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-24 text-sm text-[#9099A8]">
        <Loader2Icon className="size-5 animate-spin" />
        Loading comparison…
      </div>
    );
  }

  if (!bundle || bundle.entries.length < 2) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <GitCompareArrowsIcon className="size-10 text-primary/40" />
        <div>
          <p className="text-[15px] font-semibold text-foreground">No creators to compare</p>
          <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
            Select 2–{MAX_CREATOR_COMPARE} creators in Creator Search and click Compare.
          </p>
        </div>
        <Button asChild>
          <Link href="/discovery/search">Go to Creator Search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-3 md:px-5">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
          <Link href="/discovery/search">
            <ArrowLeftIcon className="size-3.5" />
            Back to search
          </Link>
        </Button>
        <div className="h-4 w-px bg-[#E6EAF2]" aria-hidden />
        <span className="text-[12px] font-semibold text-foreground">
          {bundle.entries.length} creators compared
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setAddToShortlistOpen(true)}
            disabled={isPending}
          >
            <ListPlusIcon className="size-3.5" />
            Add all to list
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void exportPdf()}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      <CreatorCompareMatrix
        bundle={bundle}
        onRemove={handleRemove}
        onOpenCreator={handleOpenCreator}
      />

      <CreatorDetailSheet
        creator={detailCreator}
        open={detailCreator != null}
        onOpenChange={(open) => {
          if (!open) setDetailCreator(null);
        }}
      />

      <AddToShortlistDialog
        open={addToShortlistOpen}
        onOpenChange={setAddToShortlistOpen}
        creators={creators}
        shortlists={shortlists}
        onShortlistsChange={setShortlists}
        onConfirm={handleAddToShortlistConfirm}
        busy={isPending}
      />
    </div>
  );
}
