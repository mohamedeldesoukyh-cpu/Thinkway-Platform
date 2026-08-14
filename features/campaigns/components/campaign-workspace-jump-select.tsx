"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";

import {
  DROPDOWN_EMPTY_CLASS,
  DROPDOWN_SEARCH_CLASS,
  DROPDOWN_SURFACE_LIST_CLASS,
  dropdownItemClass,
} from "@/components/ui/dropdown-surface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  loadCampaignJumpOptionsAction,
  type CampaignJumpOption,
} from "@/features/campaigns/actions/load-campaign-jump-options";
import { readListNavContext } from "@/lib/navigation/list-nav-context";
import { campaignDetailPath } from "@/lib/routing/entity-paths";
import { cn } from "@/lib/utils";

type CampaignWorkspaceJumpSelectProps = {
  currentId: string;
  currentDocumentNumber?: string | null;
  currentName?: string | null;
  className?: string;
};

function mergeOptions(
  primary: CampaignJumpOption[],
  extras: CampaignJumpOption[]
): CampaignJumpOption[] {
  const byId = new Map<string, CampaignJumpOption>();
  for (const option of [...extras, ...primary]) {
    if (!option.id) continue;
    byId.set(option.id, option);
  }
  return [...byId.values()];
}

/**
 * Always-visible Camp Code + Name jump control beside Prev/Next.
 * Dedicated crumb trigger (not SearchableSelect) so `width: 100%` dropdown styles
 * cannot collapse/hide the control in the aurora topbar flex row.
 */
export function CampaignWorkspaceJumpSelect({
  currentId,
  currentDocumentNumber,
  currentName,
  className,
}: CampaignWorkspaceJumpSelectProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CampaignJumpOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const inFlightRef = useRef(false);
  const currentOptionRef = useRef<CampaignJumpOption>({
    id: currentId,
    document_number: currentDocumentNumber?.trim() || null,
    name: currentName?.trim() || "Current campaign",
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  currentOptionRef.current = {
    id: currentId,
    document_number: currentDocumentNumber?.trim() || null,
    name: currentName?.trim() || "Current campaign",
  };

  const ensureLoaded = useCallback(async (force = false) => {
    if (!force && (loadedRef.current || inFlightRef.current)) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const current = currentOptionRef.current;
      const listNavIds = readListNavContext("campaigns")?.ids ?? [];
      const result = await loadCampaignJumpOptionsAction();
      if (result.ok && result.options.length > 0) {
        setOptions(mergeOptions(result.options, [current]));
        loadedRef.current = true;
        return;
      }

      if (listNavIds.length > 0) {
        const scoped = await loadCampaignJumpOptionsAction({ ids: listNavIds });
        if (scoped.ok && scoped.options.length > 0) {
          setOptions(mergeOptions(scoped.options, [current]));
          loadedRef.current = true;
          return;
        }
      }

      setOptions([current]);
      setError(result.ok ? "No campaigns available." : result.message);
    } catch (loadError) {
      setOptions([currentOptionRef.current]);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load campaigns."
      );
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadedRef.current = false;
    void ensureLoaded(true);
  }, [currentId, ensureLoaded]);

  useEffect(() => {
    if (!open) return;
    const focusSearch = () => searchInputRef.current?.focus();
    const raf = requestAnimationFrame(() => {
      focusSearch();
      window.setTimeout(focusSearch, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const visibleOptions = useMemo(() => {
    const merged = mergeOptions(options, [currentOptionRef.current]);
    const q = query.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((option) => {
      const code = option.document_number?.toLowerCase() ?? "";
      const name = option.name?.toLowerCase() ?? "";
      return code.includes(q) || name.includes(q) || option.id.toLowerCase().includes(q);
    });
  }, [options, query, currentId, currentDocumentNumber, currentName]);

  const triggerCode =
    currentDocumentNumber?.trim() ||
    options.find((row) => row.id === currentId)?.document_number?.trim() ||
    "Jump";

  const emptyMessage = loading
    ? "Loading campaigns…"
    : error
      ? error
      : "No campaigns found";

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void ensureLoaded();
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Jump to campaign"
          title="Search and jump to another campaign"
          className={cn(
            "inline-flex h-8 w-[13.5rem] shrink-0 items-center justify-between gap-1.5 rounded-md border border-border/80 bg-background px-2 text-left text-xs font-medium text-foreground shadow-none hover:bg-muted/40",
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate">{triggerCode}</span>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="z-[130] w-[22rem] min-w-[22rem]"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.target === searchInputRef.current) event.stopPropagation();
        }}
      >
        <div
          className={DROPDOWN_SEARCH_CLASS}
          onPointerDown={(event) => event.preventDefault()}
        >
          <SearchIcon className="thinkway-dropdown-search__icon size-3.5" aria-hidden />
          <input
            ref={searchInputRef}
            type="text"
            className="thinkway-dropdown-search__input"
            placeholder="Search camp code or name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className={DROPDOWN_SURFACE_LIST_CLASS}>
          {visibleOptions.length === 0 ? (
            <p className={DROPDOWN_EMPTY_CLASS}>{emptyMessage}</p>
          ) : (
            visibleOptions.map((option) => {
              const code = option.document_number?.trim() || "—";
              const name = option.name?.trim() || "Untitled campaign";
              const selected = option.id === currentId;
              return (
                <DropdownMenuItem
                  key={option.id}
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                    if (option.id === currentId) return;
                    router.push(
                      campaignDetailPath({
                        id: option.id,
                        document_number: option.document_number,
                        name: option.name,
                      })
                    );
                  }}
                  className={cn(
                    dropdownItemClass(selected),
                    "flex items-center justify-between gap-2"
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{code}</span>
                    <span className="thinkway-dropdown-item__description truncate">
                      {name}
                    </span>
                  </span>
                  {selected ? <CheckIcon className="size-4 shrink-0" /> : null}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
