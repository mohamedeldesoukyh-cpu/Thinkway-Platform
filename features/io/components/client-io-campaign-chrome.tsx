"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ensureClientIoForCampaignAction } from "@/features/io/actions";
import { ClientIoHeaderControls } from "@/features/io/components/client-io-header-controls";
import {
  OPERATIONAL_CHROME_LABEL,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { ClientIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  io: ClientIoRow | null;
  campaignId: string;
  contactRecipients?: Array<{ label: string; email: string }>;
};

export function ClientIoCampaignChrome({
  io,
  campaignId,
  contactRecipients = [],
}: Props) {
  const router = useRouter();
  const [ensureState, ensureAction, ensuring] = useActionState(
    ensureClientIoForCampaignAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!ensureState.message) return;
    if (ensureState.ok) {
      toast.success(ensureState.message);
      router.refresh();
    } else toast.error(ensureState.message);
  }, [ensureState, router]);

  if (io) {
    return (
      <ClientIoHeaderControls
        io={io}
        campaignId={campaignId}
        contactRecipients={contactRecipients}
      />
    );
  }

  return (
    <form action={ensureAction}>
      <input type="hidden" name="campaign_header_id" value={campaignId} />
      <Button
        size="sm"
        variant="outline"
        type="submit"
        disabled={ensuring}
        className={cn(OPERATIONAL_CHROME_LABEL, "thinkway-campaign-btn h-[38px] px-[15px] text-[13px]")}
      >
        {ensuring ? "Setting up…" : "Set up Client IO"}
      </Button>
    </form>
  );
}
