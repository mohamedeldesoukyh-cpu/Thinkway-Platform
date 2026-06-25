"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2Icon, UserPlusIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  type ImportCreatorOption,
} from "@/features/quotations/actions";
import { buildQuotationSeedFromCreator } from "@/features/quotations/shortlist-seeds";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

type ShortlistOption = { id: string; name: string; creator_count: number };
type CampaignOption = { id: string; name: string; document_number: string | null };

type Props = {
  quotationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
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

  const discoverySelection = useMemo((): UnifiedCreatorResult[] => readDiscoverySelection(), [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedDiscoveryIds(new Set(discoverySelection.map((c) => c.unified_id)));
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

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runImport(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Creators added.");
      onOpenChange(false);
      onAdded();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
              <p className="text-sm text-muted-foreground">
                No creators in your Discovery selection. Select creators in Discovery Search first.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {discoverySelection.length} creator(s) in selection
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() =>
                      setSelectedDiscoveryIds(new Set(discoverySelection.map((c) => c.unified_id)))
                    }
                  >
                    Select all
                  </Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                  {discoverySelection.map((creator) => (
                    <label
                      key={creator.unified_id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedDiscoveryIds.has(creator.unified_id)}
                        onCheckedChange={() => toggleSet(setSelectedDiscoveryIds, creator.unified_id)}
                      />
                      <span className="truncate text-sm">{creator.display_name}</span>
                    </label>
                  ))}
                </div>
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{shortlistCreators.length} creators</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() =>
                      setSelectedShortlistIds(new Set(shortlistCreators.map((c) => c.item_id)))
                    }
                  >
                    Select all
                  </Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                  {shortlistCreators.map((creator) => (
                    <label
                      key={creator.item_id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedShortlistIds.has(creator.item_id)}
                        onCheckedChange={() => toggleSet(setSelectedShortlistIds, creator.item_id)}
                      />
                      <span className="truncate text-sm">{creator.label}</span>
                    </label>
                  ))}
                </div>
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{campaignCreators.length} assignments</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() =>
                      setSelectedCampaignIds(new Set(campaignCreators.map((c) => c.item_id)))
                    }
                  >
                    Select all
                  </Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                  {campaignCreators.map((creator) => (
                    <label
                      key={creator.item_id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedCampaignIds.has(creator.item_id)}
                        onCheckedChange={() => toggleSet(setSelectedCampaignIds, creator.item_id)}
                      />
                      <span className="truncate text-sm">{creator.label}</span>
                    </label>
                  ))}
                </div>
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
            <Button
              disabled={pending}
              onClick={() =>
                runImport(() => addManualQuotationItem(quotationId, { creator_name: manualName }))
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
}: {
  quotationId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlusIcon className="size-4" />
        Add creators
      </Button>
      <AddCreatorsToQuotationModal
        quotationId={quotationId}
        open={open}
        onOpenChange={setOpen}
        onAdded={onAdded}
      />
    </>
  );
}
