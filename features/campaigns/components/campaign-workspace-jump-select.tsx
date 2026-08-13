"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchableSelect } from "@/components/forms/searchable-select";
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
 * Compact Camp Code + Name jump control beside Prev/Next in the aurora crumb.
 * Loads campaigns for scroll/search selection (code on first line, name on second).
 */
export function CampaignWorkspaceJumpSelect({
  currentId,
  currentDocumentNumber,
  currentName,
  className,
}: CampaignWorkspaceJumpSelectProps) {
  const router = useRouter();
  const [options, setOptions] = useState<CampaignJumpOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const inFlightRef = useRef(false);

  const currentOption = useMemo<CampaignJumpOption>(
    () => ({
      id: currentId,
      document_number: currentDocumentNumber?.trim() || null,
      name: currentName?.trim() || "Current campaign",
    }),
    [currentId, currentDocumentNumber, currentName]
  );

  const ensureLoaded = useCallback(async (force = false) => {
    if (!force && (loadedRef.current || inFlightRef.current)) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const listNavIds = readListNavContext("campaigns")?.ids ?? [];
      const result = await loadCampaignJumpOptionsAction();
      if (result.ok && result.options.length > 0) {
        setOptions(mergeOptions(result.options, [currentOption]));
        loadedRef.current = true;
        return;
      }

      // Fallback: enrich the Prev/Next filtered set so the dropdown is never empty
      // when the operator already has list-nav context (e.g. 1/4).
      if (listNavIds.length > 0) {
        const scoped = await loadCampaignJumpOptionsAction({ ids: listNavIds });
        if (scoped.ok && scoped.options.length > 0) {
          setOptions(mergeOptions(scoped.options, [currentOption]));
          loadedRef.current = true;
          if (!result.ok) setError(result.message);
          return;
        }
      }

      setOptions([currentOption]);
      if (!result.ok) {
        setError(result.message);
      } else {
        setError("No campaigns available to jump to.");
      }
    } catch (loadError) {
      setOptions([currentOption]);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load campaigns."
      );
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [currentOption]);

  useEffect(() => {
    loadedRef.current = false;
    void ensureLoaded(true);
  }, [currentId, ensureLoaded]);

  const selectOptions = useMemo(
    () =>
      mergeOptions(options, [currentOption]).map((option) => {
        const code = option.document_number?.trim() || "—";
        const name = option.name?.trim() || "Untitled campaign";
        return {
          value: option.id,
          label: code,
          description: name,
          keywords: [code, name, option.document_number ?? "", option.name ?? ""],
        };
      }),
    [options, currentOption]
  );

  const emptyMessage = loading
    ? "Loading campaigns…"
    : error
      ? error
      : "No campaigns found";

  return (
    <SearchableSelect
      value={currentId}
      onValueChange={(id) => {
        if (!id || id === currentId) return;
        const option = mergeOptions(options, [currentOption]).find((row) => row.id === id);
        router.push(
          campaignDetailPath({
            id,
            document_number: option?.document_number,
            name: option?.name,
          })
        );
      }}
      options={selectOptions}
      placeholder={loading ? "Loading campaigns…" : "Jump to campaign…"}
      emptyMessage={emptyMessage}
      onOpenChange={(open) => {
        if (open) void ensureLoaded();
      }}
      contentClassName="min-w-[22rem] w-[22rem]"
      className={cn(
        "h-8 min-w-[12rem] max-w-[16rem] border-border/70 bg-background px-2 text-xs shadow-none",
        className
      )}
    />
  );
}
