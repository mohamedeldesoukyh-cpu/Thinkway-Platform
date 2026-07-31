"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ensureClientIoForCampaignAction } from "@/features/io/actions";
import type { ClientIoComposerAssignment } from "@/features/io/components/client-io-assignment-composer";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import type {
  ClientIoRow,
  ClientIoSendHistoryEntry,
  ClientIoSendRecipient,
  ClientIoVersionSummary,
} from "@/features/io/types";
import type { ClientIoMilestoneDraft } from "@/lib/io/client-io-milestones";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  campaignId: string;
  campaignName: string;
  io: ClientIoRow | null;
  recipients: ClientIoSendRecipient[];
  sendHistory?: ClientIoSendHistoryEntry[];
  senderName?: string | null;
  currencyCode?: string;
  assignments?: ClientIoComposerAssignment[];
  versions?: ClientIoVersionSummary[];
  milestones?: ClientIoMilestoneDraft[];
};

export function ClientIoTab({
  campaignId,
  campaignName,
  io,
  recipients,
  sendHistory = [],
  senderName = null,
  currencyCode = "EGP",
  assignments = [],
  versions = [],
  milestones = [],
}: Props) {
  const [ensureState, ensureAction, ensuring] = useActionState(
    ensureClientIoForCampaignAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!ensureState.message) return;
    if (ensureState.ok) toast.success(ensureState.message);
    else toast.error(ensureState.message);
  }, [ensureState]);

  if (!io) {
    return (
      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-4 p-6">
          <CampaignOperationalSectionHeader
            title="Client IO"
            description={`Campaign-level insertion order for ${campaignName}. Generate, send, and track client approval.`}
          />
          <p className="text-sm text-muted-foreground">
            No Client IO record is linked to this campaign yet. Set one up to generate the branded
            document and send it to the client.
          </p>
          <form action={ensureAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="campaign_header_id" value={campaignId} />
            <Button type="submit" disabled={ensuring}>
              {ensuring ? "Setting up…" : "Set up Client IO"}
            </Button>
          </form>
        </div>
      </OperationalTableSection>
    );
  }

  return (
    <div className="space-y-4">
      <ClientIoForm
        row={io}
        recipients={recipients}
        sendHistory={sendHistory}
        senderName={senderName}
        clientDefaultTermsText={io.client_io_terms_text}
        brandName={io.brand_name}
        currencyCode={currencyCode}
        assignments={assignments}
        versions={versions}
        milestones={milestones}
      />
      <p className="text-right text-[11px] text-muted-foreground">
        <Link href={`/ios/client?io=${io.id}`} className="underline-offset-2 hover:underline">
          Open in Client IO register
        </Link>
      </p>
    </div>
  );
}
