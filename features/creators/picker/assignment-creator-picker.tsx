"use client";

import { useState, useTransition } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreatorPickerDialog } from "./creator-picker-dialog";
import { ShortlistPasteLinksPanel } from "@/features/discovery/shortlists/components/shortlist-paste-links-panel";
import { addCreatorByProfileUrlAction } from "@/features/discovery/add-creator-by-url/actions";
import { selectAssignmentCreator } from "@/features/campaigns/assignment-creator-actions";
import { parseProfileInputList } from "@/lib/social/parse-profile-url";
import type { InfluencerSearchResult } from "@/features/campaigns/types";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

export function AssignmentCreatorPicker({ value, selectedLabel, disabled, onSelect }: {
  value: string;
  selectedLabel?: string | null;
  disabled?: boolean;
  onSelect: (creator: InfluencerSearchResult) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"search" | "paste">("search");
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function choose(creator: UnifiedCreatorResult) {
    const result = await selectAssignmentCreator(creator.unified_id);
    if (!result.ok) throw new Error(result.message);
    if (await onSelect(result.influencer)) setOpen(false);
  }

  function run(work: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try { await work(); }
      catch (err) {
        const message = err instanceof Error ? err.message : "Could not select creator. Try again.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return <div className="space-y-2">
    <p className="text-sm font-medium">Influencer / creator</p>
    {value && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
      <strong>{selectedLabel || "Selected creator"}</strong>
      <p>Replacing the creator keeps the current pricing and deliverables.</p>
    </div>}
    <Button type="button" variant="outline" className="min-h-11 w-full justify-start" disabled={disabled || pending} onClick={() => { setMode("search"); setRaw(""); setError(null); setOpen(true); }}>
      <SearchIcon className="size-4" />{value ? "Search or replace creator" : "Search or add creator"}
    </Button>
    <CreatorPickerDialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}
      container="sheet" panelLayout title={value ? "Replace creator" : "Add creator"}
      description="Search internal, imported, and discovered creators, or paste a profile link. Select one creator for this assignment."
      selectionMode="single" closeOnSingleSelection={false} productionOnly
      confirmLabel={value ? "Replace creator" : "Select creator"}
      formatConfirmLabel={() => value ? "Replace creator" : "Select creator"}
      onConfirmPending={pending} isRowDisabled={() => pending}
      onConfirm={(creators) => { if (creators.length === 1 && !pending) run(() => choose(creators[0])); }}
      headerExtra={<>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-0.5">
          {(["search", "paste"] as const).map(tab => <button key={tab} type="button" disabled={pending} onClick={() => { setMode(tab); setError(null); }} className={cn("h-8 rounded-md text-xs font-semibold transition-colors", mode === tab ? "bg-white text-[#2563eb] shadow-sm" : "text-[#64748b]")}>{tab === "search" ? "Search" : "Paste links"}</button>)}
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        {pending && <p role="status" className="mt-2 text-sm text-muted-foreground">Preparing creator and checking assignment platforms...</p>}
      </>}
      bodyOverride={mode === "paste" ? <ShortlistPasteLinksPanel value={raw} onChange={setRaw} disabled={pending} /> : undefined}
      footer={mode === "paste" ? <Button type="button" className="min-h-11 flex-1" disabled={pending || !raw.trim()} onClick={() => run(async () => {
        const parsed = parseProfileInputList(raw);
        if (parsed.parsed.length !== 1 || parsed.invalid.length) throw new Error("Paste exactly one creator profile link for this assignment.");
        const result = await addCreatorByProfileUrlAction(parsed.parsed[0].normalized_profile_url);
        if (!result.ok) throw new Error(result.message);
        if (!result.creator) throw new Error("Creator is being prepared. Search for the profile again shortly.");
        toast.info(result.message);
        await choose(result.creator);
      })}>{pending ? "Preparing creator..." : "Use this creator"}</Button> : undefined}
    />
  </div>;
}
