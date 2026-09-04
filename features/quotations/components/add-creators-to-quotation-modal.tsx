"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuotationCreatorPicker } from "@/features/creators/picker/quotation-creator-picker";
import { readDiscoverySelection } from "@/features/discovery/components/creator-search/discovery-selection-storage";
import {
  addItemsToQuotation,
  addManualQuotationItem,
  importCampaignAssignmentsToQuotation,
  importShortlistItemsToQuotation,
  listCampaignImportCreators,
  listCampaignsForImport,
  listShortlistImportCreators,
  listShortlistsForImport,
} from "@/features/quotations/actions";
import type { ImportCreatorOption } from "@/lib/domains/commercial/quotation-types";
import { buildQuotationSeedFromCreator } from "@/features/quotations/shortlist-seeds";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { getTierFollowerRange } from "@/lib/creators/influencer-tier";

const MANUAL_PLATFORMS = ["Instagram", "TikTok", "YouTube", "Snapchat"] as const;
const MANUAL_TIERS = ["Nano", "Micro", "Mid", "Macro", "Mega"] as const;

function followersForManualTier(tier: string): number {
  const range = getTierFollowerRange(tier);
  if (range.minFollowers == null) return 100_000;
  if (range.maxFollowers == null) return range.minFollowers;
  return Math.round((range.minFollowers + range.maxFollowers) / 2);
}

export type QuotationCreatorsAddedResult = {
  itemIds?: string[];
};

type ShortlistOption = { id: string; name: string; creator_count: number };
type CampaignOption = { id: string; name: string; document_number: string | null };

type Props = {
  quotationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (result?: QuotationCreatorsAddedResult) => void;
  initialShortlists?: ShortlistOption[];
  initialCampaigns?: CampaignOption[];
};

export function AddCreatorsToQuotationModal({
  quotationId,
  open,
  onOpenChange,
  onAdded,
  initialShortlists,
  initialCampaigns,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [shortlists, setShortlists] = useState<ShortlistOption[]>(initialShortlists ?? []);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>(initialCampaigns ?? []);
  const [shortlistId, setShortlistId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [shortlistCreators, setShortlistCreators] = useState<ImportCreatorOption[]>([]);
  const [campaignCreators, setCampaignCreators] = useState<ImportCreatorOption[]>([]);
  const [selectedShortlistIds, setSelectedShortlistIds] = useState<Set<string>>(new Set());
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [selectedDiscoveryIds, setSelectedDiscoveryIds] = useState<Set<string>>(new Set());
  const [manualName, setManualName] = useState("");
  const [manualPlatform, setManualPlatform] = useState("Instagram");
  const [manualTier, setManualTier] = useState("Mid");

  const discoverySelection = useMemo((): UnifiedCreatorResult[] => readDiscoverySelection(), [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedDiscoveryIds(new Set(discoverySelection.map((c) => c.unified_id)));
    setManualName("");
    setManualPlatform("Instagram");
    setManualTier("Mid");
  }, [open, discoverySelection]);

  useEffect(() => {
    if (!open || initialShortlists?.length) return;
    void listShortlistsForImport().then((res) => {
      if (res.ok && res.data) setShortlists(res.data.shortlists);
    });
  }, [open, initialShortlists]);

  useEffect(() => {
    if (!open || initialCampaigns?.length) return;
    void listCampaignsForImport().then((res) => {
      if (res.ok && res.data) setCampaigns(res.data.campaigns);
    });
  }, [open, initialCampaigns]);

  useEffect(() => {
    if (!shortlistId) {
      setShortlistCreators([]);
      setSelectedShortlistIds(new Set());
      return;
    }
    startTransition(async () => {
      const res = await listShortlistImportCreators(shortlistId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const creators = res.data?.creators ?? [];
      setShortlistCreators(creators);
      setSelectedShortlistIds(new Set(creators.map((c) => c.item_id)));
    });
  }, [shortlistId]);

  useEffect(() => {
    if (!campaignId) {
      setCampaignCreators([]);
      setSelectedCampaignIds(new Set());
      return;
    }
    startTransition(async () => {
      const res = await listCampaignImportCreators(campaignId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const creators = res.data?.creators ?? [];
      setCampaignCreators(creators);
      setSelectedCampaignIds(new Set(creators.map((c) => c.item_id)));
    });
  }, [campaignId]);

  type QuotationImportResult = {
    ok: boolean;
    message?: string;
    data?: { itemIds?: string[]; added?: number };
  };

  function runImport(
    action: () => Promise<QuotationImportResult>,
    options?: { passItemIds?: boolean }
  ) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Creators added.");
      onOpenChange(false);
      onAdded(
        options?.passItemIds && res.data?.itemIds?.length
          ? { itemIds: res.data.itemIds }
          : undefined
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="discovery-suite max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add creators</DialogTitle>
          <DialogDescription>
            Import creators from Discovery selection, a shortlist, a campaign, or add a manual row.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="discovery">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="discovery">Discovery</TabsTrigger>
            <TabsTrigger value="shortlist">Shortlist</TabsTrigger>
            <TabsTrigger value="campaign">Campaign</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="discovery" className="space-y-3 pt-2">
            {discoverySelection.length === 0 ? (
              <div className="tw-empty" style={{ padding: "28px 16px" }}>
                <b>No creators in your Discovery selection</b>
                <p>
                  Pick creators in Discovery Search first — they stay in the selection until you
                  import or clear them.
                </p>
                <Link href="/discovery/search" className="tw-b pri">
                  Open Discovery Search
                </Link>
                <div className="mt-3">
                  <button type="button" className="tw-b" disabled>
                    Import creators
                  </button>
                </div>
              </div>
            ) : (
              <>
                <QuotationCreatorPicker
                  items={discoverySelection.map((c) => ({
                    id: c.unified_id,
                    label: c.display_name,
                  }))}
                  selectedIds={selectedDiscoveryIds}
                  onSelectedIdsChange={setSelectedDiscoveryIds}
                />
                <Button
                  disabled={pending || selectedDiscoveryIds.size === 0}
                  onClick={() =>
                    runImport(async () => {
                      const chosen = discoverySelection.filter((c) =>
                        selectedDiscoveryIds.has(c.unified_id)
                      );
                      return addItemsToQuotation(
                        quotationId,
                        chosen.map((c) => buildQuotationSeedFromCreator(c))
                      );
                    })
                  }
                >
                  Import {selectedDiscoveryIds.size} creator(s)
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="shortlist" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Shortlist</Label>
              <Select value={shortlistId} onValueChange={setShortlistId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a shortlist" />
                </SelectTrigger>
                <SelectContent>
                  {shortlists.map((sl) => (
                    <SelectItem key={sl.id} value={sl.id}>
                      {sl.name} ({sl.creator_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {shortlistCreators.length > 0 ? (
              <>
                <QuotationCreatorPicker
                  items={shortlistCreators.map((c) => ({
                    id: c.item_id,
                    label: c.label,
                  }))}
                  selectedIds={selectedShortlistIds}
                  onSelectedIdsChange={setSelectedShortlistIds}
                />
                <Button
                  disabled={pending || !shortlistId || selectedShortlistIds.size === 0}
                  onClick={() =>
                    runImport(() =>
                      importShortlistItemsToQuotation({
                        quotationId,
                        shortlistId,
                        itemIds: [...selectedShortlistIds],
                      })
                    )
                  }
                >
                  Import {selectedShortlistIds.size} creator(s)
                </Button>
              </>
            ) : shortlistId ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Loading creators…
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="campaign" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.document_number ?? c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {campaignCreators.length > 0 ? (
              <>
                <QuotationCreatorPicker
                  items={campaignCreators.map((c) => ({
                    id: c.item_id,
                    label: c.label,
                  }))}
                  selectedIds={selectedCampaignIds}
                  onSelectedIdsChange={setSelectedCampaignIds}
                />
                <Button
                  disabled={pending || selectedCampaignIds.size === 0}
                  onClick={() =>
                    runImport(() =>
                      importCampaignAssignmentsToQuotation({
                        quotationId,
                        assignmentIds: [...selectedCampaignIds],
                      })
                    )
                  }
                >
                  Import {selectedCampaignIds.size} creator(s)
                </Button>
              </>
            ) : campaignId ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Loading assignments…
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="manual" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="manual-creator-name">Creator name</Label>
              <Input
                id="manual-creator-name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Creator name or handle"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={manualPlatform} onValueChange={setManualPlatform}>
                  <SelectTrigger aria-label="Platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={manualTier} onValueChange={setManualTier}>
                  <SelectTrigger aria-label="Tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="tw-hint" style={{ marginTop: 9 }}>
              A manual row has no profile behind it — no followers, engagement or publications, and
              nothing to enrich. Platform and Tier are the only classification this row will carry
              until a profile is linked. Use it for a creator not yet in Discovery, then link the
              profile later.
            </div>
            <p className="tw-note wrn" style={{ margin: "9px 0 0" }}>
              Manual rows are excluded from the investment score and from similar-creator matching
              until a profile is attached.
            </p>
            <Button
              disabled={pending || !manualName.trim()}
              onClick={() =>
                runImport(
                  () =>
                    addManualQuotationItem(quotationId, {
                      creator_name: manualName,
                      platform: manualPlatform.toLowerCase(),
                      followers: followersForManualTier(manualTier),
                    }),
                  { passItemIds: true }
                )
              }
            >
              Add manual row
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AddCreatorsToQuotationButton({
  quotationId,
  onAdded,
  triggerClassName,
  label = "Add creators",
  open: openProp,
  onOpenChange,
}: {
  quotationId: string;
  onAdded: (result?: QuotationCreatorsAddedResult) => void;
  triggerClassName?: string;
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? "thinkway-campaign-btn thinkway-campaign-btn-primary"}
        onClick={() => setOpen(true)}
      >
        <UserPlusIcon className="size-3.5" />
        {label}
      </button>
      <AddCreatorsToQuotationModal
        quotationId={quotationId}
        open={open}
        onOpenChange={setOpen}
        onAdded={onAdded}
      />
    </>
  );
}
