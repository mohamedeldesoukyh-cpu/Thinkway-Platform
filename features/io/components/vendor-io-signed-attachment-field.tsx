"use client";

import { useActionState, useEffect, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailFormSection,
} from "@/features/campaigns/components/operational-detail-panel";
import { updateVendorIoAttachmentUrlAction } from "@/features/io/update-vendor-io-attachment-url-action";
import type { VendorIoRow } from "@/features/io/types";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: VendorIoRow;
};

export function VendorIoSignedAttachmentField({ row }: Props) {
  const [value, setValue] = useState(row.attachment_url ?? "");
  const [state, action, pending] = useActionState(
    updateVendorIoAttachmentUrlAction,
    INITIAL_STATE
  );
  const refresh = useRefreshCampaignAfterOperationalMutation();

  useEffect(() => {
    setValue(row.attachment_url ?? "");
  }, [row.attachment_url, row.updated_at]);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, refresh]);

  const savedUrl = row.attachment_url?.trim() || "";

  return (
    <DetailFormSection label="Signed document link" className="py-3.5">
      <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
        Paste a Google Drive, Dropbox, or hosted PDF link for the signed Vendor IO.
        There is no file upload — store the signed file in Drive and paste the share link here.
      </p>
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
        <Input
          name="attachment_url"
          type="url"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://drive.google.com/..."
          disabled={pending}
          className={DETAIL_FORM_INPUT_CLASS}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save link"}
          </Button>
          {savedUrl ? (
            <Button size="sm" variant="outline" asChild>
              <a href={savedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="mr-1.5 size-3.5" />
                Open signed copy
              </a>
            </Button>
          ) : null}
        </div>
      </form>
    </DetailFormSection>
  );
}
