"use client";

import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createShortlistAction,
  type ShortlistVisibility,
} from "@/features/discovery/actions";
import type { ShortlistCampaignOption } from "@/features/discovery/queries";

const NO_CAMPAIGN = "__none__";

export type CreatedShortlist = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: ShortlistCampaignOption[];
  onCreated: (shortlist: CreatedShortlist) => void;
};

export function CreateListDialog({ open, onOpenChange, campaigns, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [campaignId, setCampaignId] = useState<string>(NO_CAMPAIGN);
  const [visibility, setVisibility] = useState<ShortlistVisibility>("private");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setDescription("");
      setCampaignId(NO_CAMPAIGN);
      setVisibility("private");
    }
    onOpenChange(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("List name is required");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createShortlistAction({
          name: trimmed,
          description: description.trim() || null,
          campaignHeaderId: campaignId === NO_CAMPAIGN ? null : campaignId,
          visibility,
        });
        toast.success(`List "${created.name}" created`);
        onCreated({ id: created.id, name: created.name });
        handleOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create list");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create list</DialogTitle>
          <DialogDescription>
            Save creators into a reusable shortlist for this campaign or your team.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="create-list-name">
              List name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-list-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Q3 Beauty Shortlist"
              autoFocus
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-list-description">Description</Label>
            <Textarea
              id="create-list-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional notes about this list"
              rows={3}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-list-campaign">Campaign</Label>
            <Select
              value={campaignId}
              onValueChange={setCampaignId}
              disabled={isPending}
            >
              <SelectTrigger id="create-list-campaign">
                <SelectValue placeholder="No campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CAMPAIGN}>No campaign</SelectItem>
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

          <div className="space-y-1.5">
            <Label htmlFor="create-list-visibility">Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as ShortlistVisibility)}
              disabled={isPending}
            >
              <SelectTrigger id="create-list-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private — only me</SelectItem>
                <SelectItem value="shared">Shared — visible to team</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Create list
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
