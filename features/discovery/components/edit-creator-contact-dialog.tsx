"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { updateCreatorContactDetailsAction } from "@/features/discovery/creator-profile/update-creator-commercial-actions";
import {
  DISCOVERY_DIALOG_BODY_CLASS,
  DISCOVERY_DIALOG_CONTENT_CLASS,
  DISCOVERY_DIALOG_DESC_CLASS,
  DISCOVERY_DIALOG_FOOTER_CLASS,
  DISCOVERY_DIALOG_HEADER_BAR_CLASS,
  DISCOVERY_DIALOG_HEADER_WRAP_CLASS,
  DISCOVERY_DIALOG_INPUT_CLASS,
  DISCOVERY_DIALOG_TITLE_CLASS,
} from "@/features/discovery/components/design-system";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: UnifiedCreatorResult;
  onSaved?: (creator: UnifiedCreatorResult) => void;
};

export function EditCreatorContactDialog({
  open,
  onOpenChange,
  creator,
  onSaved,
}: Props) {
  const influencerId = creator.influencer_id;
  const [email, setEmail] = useState(creator.contact_email ?? "");
  const [phone, setPhone] = useState(creator.contact_phone ?? "");
  const [linksText, setLinksText] = useState(
    (creator.contact_links ?? []).join("\n")
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setEmail(creator.contact_email ?? "");
    setPhone(creator.contact_phone ?? "");
    setLinksText((creator.contact_links ?? []).join("\n"));
    setError(null);
  }, [open, creator.contact_email, creator.contact_phone, creator.contact_links]);

  function handleSave() {
    if (!influencerId) {
      setError("This creator is not linked to a vendor profile yet.");
      return;
    }

    startTransition(async () => {
      const result = await updateCreatorContactDetailsAction({
        influencerId,
        unifiedId: creator.unified_id,
        email,
        phone,
        linksText,
      });
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      if (result.creator) onSaved?.(result.creator);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DISCOVERY_DIALOG_CONTENT_CLASS, "sm:max-w-md")}>
        <div className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>
          <DialogHeader className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>
            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>
              Contact details
            </DialogTitle>
            <DialogDescription className={DISCOVERY_DIALOG_DESC_CLASS}>
              Saved to the vendor profile and all linked platforms. Manual values are
              protected from enrichment overwrite.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={cn(DISCOVERY_DIALOG_BODY_CLASS, "grid gap-3")}>
          <div className="grid gap-1.5">
            <Label htmlFor="creator-contact-email">Email</Label>
            <Input
              id="creator-contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={DISCOVERY_DIALOG_INPUT_CLASS}
              placeholder="creator@example.com"
              disabled={isPending || !influencerId}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="creator-contact-phone">Phone</Label>
            <Input
              id="creator-contact-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={DISCOVERY_DIALOG_INPUT_CLASS}
              placeholder="+20 …"
              disabled={isPending || !influencerId}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="creator-contact-links">Links</Label>
            <Textarea
              id="creator-contact-links"
              value={linksText}
              onChange={(event) => setLinksText(event.target.value)}
              className={cn(DISCOVERY_DIALOG_INPUT_CLASS, "min-h-[88px]")}
              placeholder="One URL per line"
              disabled={isPending || !influencerId}
            />
          </div>
          {!influencerId ? (
            <p className="text-[12px] text-amber-700 dark:text-amber-300">
              Promote or link this creator to a vendor profile before editing contact.
            </p>
          ) : null}
          {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className={DISCOVERY_DIALOG_FOOTER_CLASS}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || !influencerId}
          >
            {isPending ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save contact"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
