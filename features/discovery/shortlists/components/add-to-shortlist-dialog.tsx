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
import {
  DISCOVERY_DIALOG_BODY_CLASS,
  DISCOVERY_DIALOG_CANCEL_BUTTON_CLASS,
  DISCOVERY_DIALOG_CHECKBOX_CLASS,
  DISCOVERY_DIALOG_CONTENT_CLASS,
  DISCOVERY_DIALOG_CREATOR_ITEM_CLASS,
  DISCOVERY_DIALOG_EMPTY_CLASS,
  DISCOVERY_DIALOG_FIELD_LABEL_CLASS,
  DISCOVERY_DIALOG_FOOTER_ACTIONS_CLASS,
  DISCOVERY_DIALOG_FOOTER_CLASS,
  DISCOVERY_DIALOG_FORM_CLASS,
  DISCOVERY_DIALOG_FORM_PANEL_CLASS,
  DISCOVERY_DIALOG_HEADER_BAR_CLASS,
  DISCOVERY_DIALOG_HEADER_WRAP_CLASS,
  DISCOVERY_DIALOG_PANEL_INSET_CLASS,
  DISCOVERY_DIALOG_TABS_CONTENT_CLASS,
  DISCOVERY_DIALOG_HINT_CLASS,
  DISCOVERY_DIALOG_INPUT_CLASS,
  DISCOVERY_DIALOG_LIST_ITEM_CLASS,
  DROPDOWN_ITEM_SELECTED_CLASS,
  DISCOVERY_DIALOG_PANEL_CLASS,
  DISCOVERY_DIALOG_PRIMARY_BUTTON_CLASS,
  DISCOVERY_DIALOG_RECENT_BUTTON_CLASS,
  DISCOVERY_DIALOG_SEARCH_ICON_CLASS,
  DISCOVERY_DIALOG_SEARCH_INPUT_CLASS,
  DISCOVERY_DIALOG_SEARCH_WRAP_CLASS,
  DISCOVERY_DIALOG_TABS_CLASS,
  DISCOVERY_DIALOG_TABS_LIST_CLASS,
  DISCOVERY_DIALOG_TABS_TRIGGER_CLASS,
  DISCOVERY_DIALOG_TEXTAREA_CLASS,
  DISCOVERY_DIALOG_TITLE_CLASS,
} from "@/features/discovery/components/design-system";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import { cn } from "@/lib/utils";

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
      <DialogContent className={cn(DISCOVERY_DIALOG_CONTENT_CLASS, "sm:max-w-lg")}>
        <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b]">
              Discovery
            </p>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              {formatDialogTitle(creatorCount)}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-[#64748b]">
              Choose an existing shortlist or create a new one.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form className={DISCOVERY_DIALOG_FORM_CLASS} onSubmit={handleSubmit}>
          <div className={DISCOVERY_DIALOG_BODY_CLASS}>
            {pendingCreators.length > 0 ? (
              <div className={DISCOVERY_DIALOG_FORM_PANEL_CLASS}>
                <Label className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}>
                  Creators to add ({pendingCreators.length})
                </Label>
                <div
                  className={cn(
                    DISCOVERY_DIALOG_PANEL_CLASS,
                    DISCOVERY_DIALOG_PANEL_INSET_CLASS,
                    "max-h-28"
                  )}
                >
                  {pendingCreators.map((creator) => {
                    const primary = creator.platforms[0];
                    return (
                      <div key={creator.unified_id} className={DISCOVERY_DIALOG_CREATOR_ITEM_CLASS}>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {primary ? (
                            <PlatformIcon
                              platform={primary.platform}
                              size="xs"
                              variant="logo"
                              className="size-5 shrink-0"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[#0f172a]">
                              {creator.display_name}
                            </p>
                            {primary?.handle ? (
                              <p className="truncate text-[11px] text-[#64748b]">
                                @{primary.handle.replace(/^@/, "")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="discovery-dialog-creator-item__remove"
                          onClick={() => removePendingCreator(creator.unified_id)}
                          disabled={pending}
                          aria-label={`Remove ${creator.display_name}`}
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className={DISCOVERY_DIALOG_FORM_PANEL_CLASS}>
              <Tabs
                value={mode}
                onValueChange={(value) => setMode(value as "existing" | "create")}
                className={DISCOVERY_DIALOG_TABS_CLASS}
              >
              <TabsList className={DISCOVERY_DIALOG_TABS_LIST_CLASS}>
                <TabsTrigger value="existing" className={DISCOVERY_DIALOG_TABS_TRIGGER_CLASS}>
                  Add to existing
                </TabsTrigger>
                <TabsTrigger value="create" className={DISCOVERY_DIALOG_TABS_TRIGGER_CLASS}>
                  Create new
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="existing"
                className={cn(DISCOVERY_DIALOG_TABS_CONTENT_CLASS, "space-y-2.5")}
              >
                {recentShortlist ? (
                  <button
                    type="button"
                    onClick={applyRecentSuggestion}
                    disabled={pending}
                    className={cn(
                      DISCOVERY_DIALOG_RECENT_BUTTON_CLASS,
                      selectedIds.has(recentShortlist.id) &&
                        "discovery-dialog-recent-button--active"
                    )}
                  >
                    <ClockIcon className="size-3.5 shrink-0" aria-hidden />
                    <span>
                      Recently used:{" "}
                      <span className="font-semibold text-[#0f172a]">{recentShortlist.name}</span>
                    </span>
                  </button>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="shortlist-search" className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}>
                    Search shortlists
                  </Label>
                  <div className={DISCOVERY_DIALOG_SEARCH_WRAP_CLASS}>
                    <SearchIcon className={DISCOVERY_DIALOG_SEARCH_ICON_CLASS} aria-hidden />
                    <Input
                      id="shortlist-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name…"
                      className={DISCOVERY_DIALOG_SEARCH_INPUT_CLASS}
                      disabled={pending}
                    />
                  </div>
                </div>

                <div
                  className={cn(
                    DISCOVERY_DIALOG_PANEL_CLASS,
                    DISCOVERY_DIALOG_PANEL_INSET_CLASS,
                    "max-h-48"
                  )}
                >
                  {filteredShortlists.length === 0 ? (
                    <p className={DISCOVERY_DIALOG_EMPTY_CLASS}>
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
                            DISCOVERY_DIALOG_LIST_ITEM_CLASS,
                            checked && DROPDOWN_ITEM_SELECTED_CLASS
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) =>
                              toggleShortlist(shortlist.id, value === true)
                            }
                            disabled={pending}
                            className={DISCOVERY_DIALOG_CHECKBOX_CLASS}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#0f172a]">
                            {shortlist.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                {selectedIds.size > 0 ? (
                  <p className={DISCOVERY_DIALOG_HINT_CLASS}>
                    {selectedIds.size} shortlist{selectedIds.size === 1 ? "" : "s"} selected
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent
                value="create"
                className={cn(DISCOVERY_DIALOG_TABS_CONTENT_CLASS, "space-y-3")}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="new-shortlist-name" className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}>
                    Shortlist name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="new-shortlist-name"
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="e.g. Q3 Beauty Shortlist"
                    className={DISCOVERY_DIALOG_INPUT_CLASS}
                    autoFocus={mode === "create"}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="new-shortlist-description"
                    className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}
                  >
                    Description
                  </Label>
                  <Textarea
                    id="new-shortlist-description"
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                    placeholder="Optional notes about this list"
                    rows={2}
                    disabled={pending}
                    className={DISCOVERY_DIALOG_TEXTAREA_CLASS}
                  />
                </div>
              </TabsContent>
              </Tabs>
            </div>
          </div>

          <DialogFooter className={DISCOVERY_DIALOG_FOOTER_CLASS}>
            <div className={DISCOVERY_DIALOG_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={DISCOVERY_DIALOG_CANCEL_BUTTON_CLASS}
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={DISCOVERY_DIALOG_PRIMARY_BUTTON_CLASS}
                disabled={pending || (mode === "existing" ? !canSubmitExisting : !canSubmitCreate)}
              >
                {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                {mode === "create"
                  ? "Create & add"
                  : `Add to ${selectedIds.size || ""} list`.replace(/\s+/g, " ").trim()}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
