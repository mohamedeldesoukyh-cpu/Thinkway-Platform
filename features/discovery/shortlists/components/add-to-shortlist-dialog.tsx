"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ClockIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createShortlistAction } from "@/features/discovery/actions";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/lib/performance/platform-icon";

import { readRecentShortlistId, writeRecentShortlistId } from "../recent-shortlist-storage";

export type ShortlistOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creators: UnifiedCreatorResult[];
  onCreatorsChange?: (creators: UnifiedCreatorResult[]) => void;
  shortlists: ShortlistOption[];
  onShortlistsChange?: (shortlists: ShortlistOption[]) => void;
  onConfirm: (payload: { shortlistIds: string[] }) => void;
  busy?: boolean;
};

function formatDialogTitle(creatorCount: number): string {
  if (creatorCount <= 1) return "Add creator to shortlist";
  return `Add ${creatorCount} creators to shortlist`;
}

export function AddToShortlistDialog({
  open,
  onOpenChange,
  creators,
  onCreatorsChange,
  shortlists,
  onShortlistsChange,
  onConfirm,
  busy,
}: Props) {
  const [mode, setMode] = useState<"existing" | "create">("existing");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingCreators, setPendingCreators] = useState<UnifiedCreatorResult[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  const recentShortlistId = useMemo(() => readRecentShortlistId(), [open]);
  const recentShortlist = useMemo(
    () => shortlists.find((s) => s.id === recentShortlistId) ?? null,
    [shortlists, recentShortlistId]
  );

  const filteredShortlists = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return shortlists;
    return shortlists.filter((s) => s.name.toLowerCase().includes(query));
  }, [search, shortlists]);

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setSearch("");
    setSelectedIds(new Set());
    setPendingCreators(creators);
    setNewName("");
    setNewDescription("");
  }, [open, creators]);

  function removePendingCreator(unifiedId: string) {
    setPendingCreators((prev) => {
      const next = prev.filter((creator) => creator.unified_id !== unifiedId);
      onCreatorsChange?.(next);
      return next;
    });
  }

  function toggleShortlist(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function applyRecentSuggestion() {
    if (!recentShortlist) return;
    toggleShortlist(recentShortlist.id, !selectedIds.has(recentShortlist.id));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingCreators.length === 0) {
      toast.error("Select at least one creator.");
      return;
    }

    if (mode === "existing") {
      const shortlistIds = [...selectedIds];
      if (shortlistIds.length === 0) {
        toast.error("Select at least one shortlist.");
        return;
      }
      writeRecentShortlistId(shortlistIds[0]!);
      onConfirm({ shortlistIds });
      return;
    }

    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Shortlist name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createShortlistAction({
          name: trimmed,
          description: newDescription.trim() || null,
        });
        onShortlistsChange?.(
          shortlists.some((s) => s.id === created.id)
            ? shortlists
            : [{ id: created.id as string, name: created.name as string }, ...shortlists]
        );
        writeRecentShortlistId(created.id as string);
        onConfirm({ shortlistIds: [created.id as string] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create shortlist");
      }
    });
  }

  const pending = busy || isPending;
  const canSubmitExisting = mode === "existing" && selectedIds.size > 0 && pendingCreators.length > 0;
  const canSubmitCreate = mode === "create" && newName.trim().length > 0 && pendingCreators.length > 0;
  const creatorCount = pendingCreators.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatDialogTitle(creatorCount)}</DialogTitle>
          <DialogDescription>
            Choose an existing shortlist or create a new one. Nothing is preselected — pick where
            these creators should go.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {pendingCreators.length > 0 ? (
            <div className="space-y-2">
              <Label>Creators to add ({pendingCreators.length})</Label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
                {pendingCreators.map((creator) => {
                  const primary = creator.platforms[0];
                  return (
                    <div
                      key={creator.unified_id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {primary ? (
                          <PlatformIcon
                            platform={primary.platform}
                            size="xs"
                            className="size-5 shrink-0 rounded-full"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{creator.display_name}</p>
                          {primary?.handle ? (
                            <p className="truncate text-xs text-muted-foreground">
                              @{primary.handle.replace(/^@/, "")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removePendingCreator(creator.unified_id)}
                        disabled={pending}
                        aria-label={`Remove ${creator.display_name}`}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as "existing" | "create")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">Add to existing</TabsTrigger>
              <TabsTrigger value="create">Create new</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-3 pt-3">
              {recentShortlist ? (
                <button
                  type="button"
                  onClick={applyRecentSuggestion}
                  disabled={pending}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    selectedIds.has(recentShortlist.id)
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <ClockIcon className="size-4 shrink-0" aria-hidden />
                  <span>
                    Recently used:{" "}
                    <span className="font-medium text-foreground">{recentShortlist.name}</span>
                  </span>
                </button>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="shortlist-search">Search shortlists</Label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="shortlist-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name…"
                    className="pl-9"
                    disabled={pending}
                  />
                </div>
              </div>

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
                {filteredShortlists.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {shortlists.length === 0
                      ? "No shortlists yet. Create a new one instead."
                      : "No shortlists match your search."}
                  </p>
                ) : (
                  filteredShortlists.map((shortlist) => {
                    const checked = selectedIds.has(shortlist.id);
                    return (
                      <label
                        key={shortlist.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/40",
                          checked && "bg-muted/30"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleShortlist(shortlist.id, value === true)
                          }
                          disabled={pending}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {shortlist.name}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              {selectedIds.size > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {selectedIds.size} shortlist{selectedIds.size === 1 ? "" : "s"} selected
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="create" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-shortlist-name">
                  Shortlist name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-shortlist-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Q3 Beauty Shortlist"
                  autoFocus={mode === "create"}
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-shortlist-description">Description</Label>
                <Textarea
                  id="new-shortlist-description"
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="Optional notes about this list"
                  rows={3}
                  disabled={pending}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || (mode === "existing" ? !canSubmitExisting : !canSubmitCreate)}
            >
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {mode === "create" ? "Create & add" : `Add to ${selectedIds.size || ""} list`.replace(/\s+/g, " ").trim()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
