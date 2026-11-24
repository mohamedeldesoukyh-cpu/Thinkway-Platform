"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { isAddableCreator } from "@/features/discovery/shortlists/add-to-shortlist-policy";
import { listCreatorSources, listSourceCreators, type CreatorSourceKind, type CreatorSourceOption } from "./creator-source-actions";
import { isCreatorOnExistingList, toggleCreatorSelection } from "./creator-selection-utils";
import { CreatorSelectionTable } from "./creator-selection-table";

export function CreatorSourcePanel({ shortlistId, existingKeys, pending, onConfirm }: {
  shortlistId: string;
  existingKeys: Set<string>;
  pending: boolean;
  onConfirm: (creators: UnifiedCreatorResult[]) => void;
}) {
  const [kind, setKind] = useState<CreatorSourceKind>("shortlist");
  const [sourceId, setSourceId] = useState("");
  const [options, setOptions] = useState<CreatorSourceOption[]>([]);
  const [creators, setCreators] = useState<UnifiedCreatorResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listCreatorSources(kind).then((rows) => {
      if (!cancelled) setOptions(rows.filter((row) => kind !== "shortlist" || row.id !== shortlistId));
    }).catch((error: unknown) => {
      if (!cancelled) setSourceError(error instanceof Error ? error.message : "Unable to load sources.");
    }).finally(() => { if (!cancelled) setLoadingSources(false); });
    return () => { cancelled = true; };
  }, [kind, shortlistId, retry]);

  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    void listSourceCreators(kind, sourceId).then((rows) => {
      if (!cancelled) setCreators(rows);
    }).catch((error: unknown) => {
      if (!cancelled) setCreatorError(error instanceof Error ? error.message : "Unable to load creators.");
    }).finally(() => { if (!cancelled) setLoadingCreators(false); });
    return () => { cancelled = true; };
  }, [kind, sourceId, retry]);

  function resetSource(id: string) {
    setSourceId(id);
    setCreators([]);
    setSelected(new Set());
    setQuery("");
    setCreatorError(null);
    setLoadingCreators(Boolean(id));
  }

  function retryLoad() {
    setSourceError(null);
    setCreatorError(null);
    setLoadingSources(true);
    setLoadingCreators(Boolean(sourceId));
    setRetry((value) => value + 1);
  }

  const eligible = creators.filter((creator) => isAddableCreator(creator) && !isCreatorOnExistingList(creator, existingKeys));
  const chosen = eligible.filter((creator) => selected.has(creator.unified_id));
  const allSelected = eligible.length > 0 && chosen.length === eligible.length;
  const visible = creators.filter((creator) =>
    `${creator.display_name} ${creator.platforms.map((platform) => platform.handle).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-1.5">
            <label id="creator-source-type-label" className="text-xs font-medium">Add from</label>
            <Select value={kind} disabled={pending} onValueChange={(value) => {
              setKind(value as CreatorSourceKind);
              setOptions([]);
              setSourceError(null);
              setLoadingSources(true);
              resetSource("");
            }}>
              <SelectTrigger aria-labelledby="creator-source-type-label" className="min-h-11 w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="shortlist">Shortlist</SelectItem><SelectItem value="campaign">Campaign</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <label id="creator-source-label" className="text-xs font-medium">{kind === "shortlist" ? "Choose shortlist" : "Choose campaign"}</label>
            <Select value={sourceId} onValueChange={resetSource} disabled={pending || loadingSources || Boolean(sourceError)}>
              <SelectTrigger aria-labelledby="creator-source-label" className="min-h-11 w-full min-w-0"><SelectValue placeholder={loadingSources ? "Loading…" : `Choose a ${kind}`} /></SelectTrigger>
              <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.code ? `${option.code} · ` : ""}{option.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {sourceError ? <div role="alert" className="text-sm text-destructive">{sourceError} <Button variant="link" onClick={retryLoad}>Retry</Button></div> : null}
        {!loadingSources && !sourceError && options.length === 0 ? <p className="text-sm text-muted-foreground">No {kind === "shortlist" ? "other shortlists" : "campaigns"} available.</p> : null}
        {sourceId ? <Input aria-label="Filter source creators" placeholder="Filter creators…" value={query} disabled={pending} onChange={(event) => setQuery(event.target.value)} /> : null}
      </div>
      {!sourceId ? <p className="p-8 text-center text-sm text-muted-foreground">Choose a {kind} to see its creators.</p> : (
        <>
          <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
            <span aria-live="polite">{chosen.length} selected · {eligible.length} available</span>
            <Button variant="ghost" className="min-h-11 text-primary" disabled={pending || loadingCreators || Boolean(creatorError) || eligible.length === 0} onClick={() => setSelected(allSelected ? new Set() : new Set(eligible.map((creator) => creator.unified_id)))}>{allSelected ? "Deselect all" : "Select all"}</Button>
          </div>
          {!loadingCreators && !creatorError && visible.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{creators.length ? "No creators match your filter." : `This ${kind} has no available creators.`}</p> : (
            <CreatorSelectionTable creators={visible} selectedIds={selected} existingKeys={existingKeys}
              onToggle={(creator) => {
                if (!pending && isAddableCreator(creator) && !isCreatorOnExistingList(creator, existingKeys)) setSelected((current) => toggleCreatorSelection(current, creator.unified_id));
              }}
              isRowDisabled={(creator) => pending || !isAddableCreator(creator)}
              loading={loadingCreators} error={creatorError} onRetry={retryLoad}
              variant="panel" total={visible.length} showAddMissingCreator={false} className="min-h-0 flex-1" />
          )}
        </>
      )}
      <div className="shrink-0 border-t px-6 py-4">
        <Button className="min-h-11 w-full" disabled={pending || loadingCreators || Boolean(creatorError) || chosen.length === 0} onClick={() => onConfirm(chosen)}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {chosen.length ? `Add ${chosen.length} creator${chosen.length === 1 ? "" : "s"} to shortlist` : "Add to shortlist"}
        </Button>
      </div>
    </div>
  );
}
