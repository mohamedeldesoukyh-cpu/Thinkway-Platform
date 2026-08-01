"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ensureClientIoForCampaignAction } from "@/features/io/actions";
import type { ClientIoComposerAssignment } from "@/features/io/components/client-io-assignment-composer";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import {
  AuroraEmptyState,
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import type {
  ClientIoRow,
  ClientIoSendHistoryEntry,
  ClientIoSendRecipient,
  ClientIoVersionSummary,
} from "@/features/io/types";
import type { ClientIoMilestoneDraft } from "@/lib/io/client-io-milestones";
import { formatMoney } from "@/features/campaigns/utils";

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
  /** Deep-link (?io=) expands the document workspace. */
  forceOpenRegister?: boolean;
};

function statusTone(
  status: string | undefined
): "green" | "blue" | "amber" | "rose" | "mut" {
  if (status === "approved") return "green";
  if (status === "rejected") return "rose";
  if (status === "sent" || status === "under_client_review") return "blue";
  if (status === "generated") return "amber";
  return "mut";
}

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
  forceOpenRegister = false,
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

  const latestSend = sendHistory[0] ?? null;
  const agreedAmount = useMemo(
    () =>
      assignments.reduce((sum, row) => sum + (Number(row.revenue_before_vat) || 0), 0),
    [assignments]
  );

  const setupAction = (
    <form action={ensureAction}>
      <input type="hidden" name="campaign_header_id" value={campaignId} />
      <Button
        type="submit"
        disabled={ensuring}
        className="thinkway-campaign-btn thinkway-campaign-btn-primary"
      >
        {ensuring ? "Setting up…" : "Set up Client IO"}
      </Button>
    </form>
  );

  if (!io) {
    return (
      <CampaignWorkspaceFrame
        title="Client IO"
        subtitle={`Campaign-level insertion order for ${campaignName}`}
        status={<AuroraStatusPill tone="mut">Not set up</AuroraStatusPill>}
        stats={[
          { key: "documents", label: "Documents", value: "0", tone: "mut" },
          { key: "generated", label: "Generated", value: "0", tone: "mut" },
          { key: "sent", label: "Sent", value: "0", tone: "mut" },
          { key: "approved", label: "Approved", value: "0", tone: "mut" },
          { key: "pending", label: "Pending", value: "0", tone: "mut" },
        ]}
        empty={
          <AuroraEmptyState
            title="Client IO is not available yet."
            description="This stage unlocks after Assignments are ready. Commercial owns the next action: generate the Client IO so the client can approve commercial terms."
            action={setupAction}
          />
        }
      />
    );
  }

  return (
    <CampaignWorkspaceFrame
      title="Client IO"
      subtitle={`${io.document_number ?? "CIO"} · ${campaignName}`}
      status={
        <AuroraStatusPill tone={statusTone(io.status)}>
          {io.status.replaceAll("_", " ")}
        </AuroraStatusPill>
      }
      tools={
        <Button asChild variant="outline" size="sm" className="thinkway-campaign-btn">
          <Link href={`/ios/client?io=${io.id}`}>Open register</Link>
        </Button>
      }
      stats={[
        {
          key: "documents",
          label: "Documents",
          value: "1",
        },
        {
          key: "generated",
          label: "Generated",
          value: String(Math.max(versions.length || 1, io.status === "draft" ? 0 : 1)),
          tone: "blue",
        },
        {
          key: "sent",
          label: "Sent",
          value: io.sent_at || latestSend ? "Yes" : "No",
          tone: io.sent_at || latestSend ? "blue" : "mut",
        },
        {
          key: "approved",
          label: "Approved",
          value: io.status === "approved" ? "Yes" : "No",
          tone: io.status === "approved" ? "pos" : "mut",
        },
        {
          key: "pending",
          label: "Pending",
          value:
            io.status === "approved" || io.status === "rejected" ? "No" : "Yes",
          tone:
            io.status === "approved" || io.status === "rejected" ? "mut" : "amber",
        },
        {
          key: "amount",
          label: "Agreed amount",
          value: formatMoney(agreedAmount, currencyCode),
          tone: "blue",
        },
      ]}
      detailsLabel="Document & delivery details"
      details={
        <div className="thinkway-aurora-doc-meta">
          <div className="thinkway-aurora-doc-panel">
            <div className="eyebrow">Document</div>
            <div className="thinkway-aurora-doc-row">
              <span className="dk">CIO number</span>
              <span className="dv text-[var(--camp-blue-text)]">
                {io.document_number ?? "—"}
              </span>
            </div>
            <div className="thinkway-aurora-doc-row">
              <span className="dk">Brand</span>
              <span className="dv">{io.brand_name ?? "—"}</span>
            </div>
            <div className="thinkway-aurora-doc-row">
              <span className="dk">PDF</span>
              <span className="dv">
                {io.generated_pdf_url || io.document_generated_at
                  ? "Attached"
                  : "Not generated"}
              </span>
            </div>
          </div>
          <div className="thinkway-aurora-doc-panel">
            <div className="eyebrow">Approval</div>
            <div className="thinkway-aurora-doc-row">
              <span className="dk">Approved at</span>
              <span className="dv">
                {io.approved_at
                  ? new Date(io.approved_at).toLocaleDateString()
                  : "—"}
              </span>
            </div>
            <div className="thinkway-aurora-doc-row">
              <span className="dk">Versions</span>
              <span className="dv">{String(versions.length || 1)}</span>
            </div>
          </div>
          <div className="thinkway-aurora-doc-panel">
            <div className="eyebrow">Delivery</div>
            <div className="thinkway-aurora-doc-row">
              <span className="dk">Last recipient</span>
              <span className="dv">
                {latestSend?.recipient_email ??
                  recipients.find((r) => r.email.trim())?.email ??
                  "—"}
              </span>
            </div>
            <div className="thinkway-aurora-doc-row">
              <span className="dk">History</span>
              <span className="dv">{sendHistory.length} sends</span>
            </div>
          </div>
        </div>
      }
      registerLabel="Document workspace"
      collapseRegister
      registerCount={1}
      registerStorageKey={`client-io-${campaignId}`}
      forceRegisterOpen={Boolean(forceOpenRegister)}
    >
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
    </CampaignWorkspaceFrame>
  );
}
