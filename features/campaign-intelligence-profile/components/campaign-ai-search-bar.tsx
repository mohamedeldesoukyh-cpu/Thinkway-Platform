"use client";

import { useEffect, useRef, useState } from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getCampaignIntelligenceProfileAction,
  listRecentCampaignIntelligenceProfilesAction,
} from "../actions/profile-actions";
import type { CampaignIntelligenceProfile } from "../types/profile";

const STORAGE_KEY = "thinkway:active-campaign-intelligence-profile";

type ProfileOption = {
  id: string;
  title: string;
  brandName?: string;
  status: string;
};

type Props = {
  profileIdFromUrl?: string | null;
  activeProfileId?: string | null;
  onProfileReady: (profileId: string, profile: CampaignIntelligenceProfile) => void;
  onUseAiCampaign: () => void;
  disabled?: boolean;
};

export function CampaignAiSearchBar({
  profileIdFromUrl,
  activeProfileId,
  onProfileReady,
  onUseAiCampaign,
  disabled,
}: Props) {
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const onProfileReadyRef = useRef(onProfileReady);
  onProfileReadyRef.current = onProfileReady;

  const effectiveId = activeProfileId ?? profileIdFromUrl ?? selectedId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listRecentCampaignIntelligenceProfilesAction();
        if (!cancelled) setProfiles(list);
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const initial = profileIdFromUrl ?? activeProfileId ?? stored ?? list[0]?.id ?? null;
        if (initial && !cancelled) {
          setSelectedId(initial);
          const row = await getCampaignIntelligenceProfileAction(initial);
          if (row?.profile) {
            onProfileReadyRef.current(initial, row.profile);
            localStorage.setItem(STORAGE_KEY, initial);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileIdFromUrl, activeProfileId]);

  async function handleSelect(id: string) {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
    const row = await getCampaignIntelligenceProfileAction(id);
    if (row?.profile) {
      onProfileReady(id, row.profile);
    }
  }

  const canUseAi = Boolean(effectiveId) && !disabled;

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <BrainIcon className="size-5 shrink-0 text-[#1D9E75]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">AI Campaign Search</p>
          <p className="text-xs text-muted-foreground">
            Save your brief above, then run a creator search from it.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {loading ? (
          <span className="text-sm text-muted-foreground">Loading briefs…</span>
        ) : profiles.length > 0 ? (
          <Select value={effectiveId ?? undefined} onValueChange={handleSelect}>
            <SelectTrigger className="h-9 w-full min-w-[220px] text-sm sm:w-[260px]">
              <SelectValue placeholder="Select saved brief" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-sm">
                  {p.title}
                  {p.brandName ? ` · ${p.brandName}` : ""}
                  {p.status === "draft" ? " (draft)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">Upload a brief above first</span>
        )}
        <Button
          type="button"
          className="h-9 gap-1"
          disabled={!canUseAi}
          onClick={onUseAiCampaign}
        >
          Use AI Campaign
          <ChevronDownIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export { STORAGE_KEY };
