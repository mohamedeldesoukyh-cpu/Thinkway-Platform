"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
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

import { moveShortlistToCampaign } from "../actions";
import {
  buildNameMismatchWarning,
  shouldWarnNameMismatch,
  type MoveTarget,
} from "../move-policy";
import type { ShortlistBrandOption, ShortlistCampaignOption } from "../types";

type Mode = "existing" | "new";

export function MoveToCampaignDialog({
  open,
  onOpenChange,
  shortlistId,
  shortlistName,
  selectedItemIds,
  campaigns,
  brands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortlistId: string;
  shortlistName: string;
  selectedItemIds: string[];
  campaigns: ShortlistCampaignOption[];
  brands: ShortlistBrandOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("existing");
  const [campaignId, setCampaignId] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) ?? null,
    [campaigns, campaignId]
  );

  function buildTarget(): MoveTarget | null {
    if (mode === "existing") {
      if (!selectedCampaign) return null;
      return {
        mode: "existing",
        campaignId: selectedCampaign.id,
        campaignName: selectedCampaign.name,
      };
    }
    return {
      mode: "new",
      name,
      brandId,
      country: country || null,
      startDate: startDate || null,
      endDate: endDate || null,
      budget: budget ? Number(budget) : null,
    };
  }

  function submit(acknowledgeNameMismatch: boolean) {
    const target = buildTarget();
    if (!target) {
      toast.error("Select a campaign to move creators into.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await moveShortlistToCampaign({
          shortlistId,
          itemIds: selectedItemIds,
          target,
          acknowledgeNameMismatch,
        });
        if (result.ok) {
          toast.success(result.message ?? "Creators moved");
          setPendingWarning(null);
          onOpenChange(false);
          if (result.campaignId) {
            router.push(`/campaigns/${result.campaignId}`);
          }
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Move failed");
      }
    });
  }

  function handlePrimary() {
    if (selectedItemIds.length === 0) {
      toast.error("Select at least one creator to move.");
      return;
    }

    if (mode === "existing") {
      const campaign = selectedCampaign;
      if (!campaign) {
        toast.error("Select a campaign.");
        return;
      }
      // Spec §8 — warn when the shortlist name differs from the campaign name.
      if (shouldWarnNameMismatch(shortlistName, campaign.name)) {
        setPendingWarning(
          buildNameMismatchWarning(campaign.document_number ?? campaign.name)
        );
        return;
      }
    }

    submit(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        {pendingWarning ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm campaign move</DialogTitle>
              <DialogDescription>{pendingWarning}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingWarning(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={() => submit(true)} disabled={isPending}>
                {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Move {selectedItemIds.length} creator(s) to campaign</DialogTitle>
              <DialogDescription>
                Selected creators will be assigned with status “Suggested”.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "existing" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("existing")}
              >
                Existing campaign
              </Button>
              <Button
                type="button"
                variant={mode === "new" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("new")}
              >
                New campaign
              </Button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-1.5">
                <Label htmlFor="move-campaign">Campaign</Label>
                <Select value={campaignId} onValueChange={setCampaignId} disabled={isPending}>
                  <SelectTrigger id="move-campaign">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.document_number
                          ? `${campaign.document_number} · ${campaign.name}`
                          : campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-campaign-name">
                    Campaign name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-campaign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Spring Launch"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-campaign-brand">
                    Brand <span className="text-destructive">*</span>
                  </Label>
                  <Select value={brandId} onValueChange={setBrandId} disabled={isPending}>
                    <SelectTrigger id="new-campaign-brand">
                      <SelectValue placeholder="Select a brand (sets client)" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.client_name
                            ? `${brand.name} · ${brand.client_name}`
                            : brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-country">Country</Label>
                    <Input
                      id="new-campaign-country"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder="e.g. SA"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-budget">Budget</Label>
                    <Input
                      id="new-campaign-budget"
                      type="number"
                      min={0}
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="0"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-start">Start date</Label>
                    <Input
                      id="new-campaign-start"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-campaign-end">End date</Label>
                    <Input
                      id="new-campaign-end"
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A TW-YYYY-NNNN number is generated automatically and the campaign
                  starts in Draft.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handlePrimary} disabled={isPending}>
                {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Move creators
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
