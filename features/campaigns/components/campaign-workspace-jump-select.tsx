"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchableSelect } from "@/components/forms/searchable-select";
import {
  loadCampaignListNavOptionsAction,
  type CampaignNavOption,
} from "@/features/campaigns/actions/campaign-list-nav-ids";
import { campaignDetailPath } from "@/lib/routing/entity-paths";
import { cn } from "@/lib/utils";

type CampaignWorkspaceJumpSelectProps = {
  currentId: string;
  className?: string;
};

/**
 * Compact Camp Code + Name jump control beside Prev/Next in the aurora crumb.
 * Loads all campaigns once (cached) so operators can type a code or scroll the list.
 */
export function CampaignWorkspaceJumpSelect({
  currentId,
  className,
}: CampaignWorkspaceJumpSelectProps) {
  const router = useRouter();
  const [options, setOptions] = useState<CampaignNavOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const ensureLoaded = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const result = await loadCampaignListNavOptionsAction();
      if (result.ok) {
        setOptions(result.options);
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }, [loaded, loading]);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const selectOptions = useMemo(
    () =>
      options.map((option) => {
        const code = option.document_number?.trim() || "—";
        return {
          value: option.id,
          label: code,
          description: option.name,
          keywords: [code, option.name, option.document_number ?? ""].filter(Boolean),
        };
      }),
    [options]
  );

  return (
    <SearchableSelect
      value={currentId}
      onValueChange={(id) => {
        if (!id || id === currentId) return;
        const option = options.find((row) => row.id === id);
        router.push(
          campaignDetailPath({
            id,
            document_number: option?.document_number,
            name: option?.name,
          })
        );
      }}
      options={selectOptions}
      placeholder={loading && !loaded ? "Loading campaigns…" : "Jump to campaign…"}
      disabled={loading && !loaded}
      className={cn(
        "h-8 min-w-[13rem] max-w-[18rem] border-border/70 bg-background px-2 text-xs shadow-none",
        className
      )}
    />
  );
}
