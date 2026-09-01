import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";
import { CreatorApproveVendorIoForm } from "@/features/portals/components/creator-approve-vendor-io-form";
import { CreatorRejectVendorIoForm } from "@/features/portals/components/creator-reject-vendor-io-form";
import { CreatorCampaignProgress } from "@/features/creator-workspace/components/creator-campaign-progress";
import { CreatorPostPerformancePanel } from "@/features/creator-workspace/components/creator-post-performance";
import { CreatorCampaignTabs } from "@/features/creator-workspace/components/creator-campaign-tabs";
import { CreatorDocumentationUnitList } from "@/features/creator-workspace/components/creator-documentation-unit-list";
import { CreatorDeliverableNavRow } from "@/features/creator-workspace/components/creator-campaign-cards";
import {
  CreatorEmpty,
  CreatorKpis,
  CreatorMoneyStrip,
  CreatorPageHeader,
} from "@/features/creator-workspace/components/creator-workspace-ui";
import {
  creatorCampaignUnitCounts,
  creatorCampaignStageIndex,
  projectCreatorCampaignStage,
  CREATOR_CAMPAIGN_STAGES,
} from "@/features/creator-workspace/campaign-progress";
import { campaignCreatorActionLine } from "@/features/creator-workspace/campaign-card-model";
import {
  campaignStatusPill,
  paymentPendingPill,
  unitStatusPill,
} from "@/features/creator-workspace/chrome";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import { creatorPaymentExplanationForRow } from "@/features/creator-workspace/payment-copy";
import { unitNeedsPublicationLink } from "@/features/creator-workspace/unit-status";
import type {
  CreatorCampaignDetail,
  CreatorCampaignRow,
  CreatorPaymentRow,
  CreatorPublicationRow,
} from "@/features/portals/types";
import { formatPortalDate } from "@/features/portals/components/portal-table-utils";
import { formatMoneyDetail } from "@/lib/finance/currency-format";
import type { CreatorInsightPack } from "@/lib/creator-insights/types";

function formatDate(value: string | null): string {
  return formatPortalDate(value);
}

export function CreatorCampaignWorkspace({
  detail,
  units,
  payment,
  publications: _publications,
  insightPack,
  campaignRow,
}: {
  detail: CreatorCampaignDetail;
  units: CreatorUnitView[];
  payment: CreatorPaymentRow | null;
  publications: CreatorPublicationRow[];
  insightPack: CreatorInsightPack | null;
  campaignRow: CreatorCampaignRow | null;
}) {
  const counts = creatorCampaignUnitCounts(units);
  const stage = projectCreatorCampaignStage({
    hasBrief: Boolean(detail.brief?.trim()),
    vendorIoStatus: detail.vendor_io_status,
    paymentStatus: payment?.payment_status ?? null,
    units,
  });
  const stageLabel = CREATOR_CAMPAIGN_STAGES[creatorCampaignStageIndex(stage)]?.label ?? "Campaign";
  const nextActionRaw = campaignCreatorActionLine(
    campaignRow ?? {
      campaign_header_id: detail.campaign_header_id,
      campaign_document_number: detail.campaign_document_number,
      campaign_name: detail.campaign_name,
      campaign_status: detail.campaign_status,
      assignment_id: detail.assignment_id,
      assignment_status: detail.assignment_status,
      agreed_amount: detail.agreed_amount,
      currency_code: detail.currency_code,
      vendor_payment_status: payment?.vendor_payment_status ?? "pending",
      start_date: detail.start_date,
      end_date: detail.end_date,
      vendor_io_status: detail.vendor_io_status,
      deliverable_total: counts.total,
      pending_deliverables: counts.pending,
      completed_deliverables: counts.completed,
      approved_deliverables: counts.approved,
      published_deliverables: counts.published,
      publication_total: _publications.length,
      recent_publication_status: null,
      publication_needed: units.filter((unit) => unitNeedsPublicationLink(unit)).length,
    }
  );
  const nextAction = nextActionRaw === "All on track" ? "Nothing due" : nextActionRaw;
  const status = campaignStatusPill(detail.campaign_status);
  const paymentPill = paymentPendingPill(
    payment?.vendor_payment_status ?? payment?.payment_status ?? campaignRow?.vendor_payment_status
  );
  const progressPct = counts.total ? Math.round((counts.published / counts.total) * 100) : 0;
  const money = (amount: number) => formatMoneyDetail(amount, detail.currency_code);
  const postAnalyses = (insightPack?.postAnalyses ?? []).filter(
    (row) => !row.campaignHeaderId || row.campaignHeaderId === detail.campaign_header_id
  );

  return (
    <div>
      <div className="backrow">
        <Link href="/creator-portal/campaigns" className="btn btn-sm back">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Campaigns
        </Link>
      </div>

      <CreatorPageHeader
        title={detail.campaign_name}
        description={
          <>
            <DocumentNumber value={detail.campaign_document_number} /> · {formatDate(detail.start_date)} →{" "}
            {formatDate(detail.end_date)}
          </>
        }
      />
      <div style={{ display: "flex", gap: 6, marginTop: -9, marginBottom: 16 }}>
        <span className={status.className}>{status.label}</span>
        <span className={paymentPill.className}>{paymentPill.label}</span>
      </div>

      <CreatorKpis
        items={[
          {
            label: "Agreed fee",
            value: money(detail.agreed_amount),
            hint: "For this campaign",
            valueSize: "md",
          },
          {
            label: "Deliverables",
            value: counts.total,
            hint: `${counts.published} delivered`,
          },
          {
            label: "Progress",
            value: `${progressPct}%`,
            hint: stageLabel,
            tone: "ok",
          },
          {
            label: "Next",
            value: nextAction,
            hint: "Your next step",
            tone: "pend",
            valueSize: "sm",
          },
        ]}
      />

      <CreatorCampaignTabs
        sections={{
          overview: (
            <>
              <div className="grp__h">
                <span className="grp__t">Progress</span>
              </div>
              <CreatorCampaignProgress stage={stage} />
              <div className="grp" style={{ marginTop: 24 }}>
                <div className="grp__h">
                  <span className="grp__t">What to deliver</span>
                </div>
                {units.length === 0 ? (
                  <CreatorEmpty
                    title="No deliverables yet"
                    description="Thinkway will add them here."
                  />
                ) : (
                  units.map((unit) => {
                    const pill = unitStatusPill(unit.statusLabel, unit.status);
                    return (
                      <CreatorDeliverableNavRow
                        key={unit.unitKey}
                        href={`/creator-portal/campaigns/${detail.campaign_header_id}?tab=deliverables`}
                        title={unit.label}
                        meta={`${unit.campaignName}${
                          unit.dueDate ? ` · due ${formatDate(unit.dueDate)}` : " · no due date"
                        }`}
                        platform={unit.platform}
                        statusClassName={pill.className}
                        statusLabel={pill.label}
                      />
                    );
                  })
                )}
              </div>
              {postAnalyses.length > 0 ? (
                <div className="grp" style={{ marginTop: 24 }}>
                  <div className="grp__h">
                    <span className="grp__t">Performance analysis</span>
                    <span className="grp__m">{postAnalyses.length} live posts</span>
                  </div>
                  <p className="note" style={{ marginBottom: 12 }}>
                    How each live post, reel, or video is doing versus your recent average and the
                    agreed fee on that post.
                  </p>
                  {postAnalyses.map((analysis) => (
                    <div key={analysis.publicationId} className="card" style={{ marginBottom: 12 }}>
                      <p className="ck">{analysis.formatLabel}</p>
                      <CreatorPostPerformancePanel analysis={analysis} />
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ),
          brief: detail.brief?.trim() ? (
            <div className="card">
              <p className="ck">Brief</p>
              <h2 className="sec">What Thinkway needs</h2>
              <p className="note" style={{ fontSize: 13.5, color: "var(--cw-text-2)", marginTop: 10 }}>
                {detail.brief}
              </p>
            </div>
          ) : (
            <CreatorEmpty
              title="No brief provided yet"
              description="Thinkway will share the brief here before you start."
            />
          ),
          deliverables:
            units.length === 0 ? (
              <CreatorEmpty
                title="No deliverables yet"
                description="Thinkway will add them here."
              />
            ) : (
              <CreatorDocumentationUnitList
                units={units}
                showCampaignLink={false}
                insightPack={insightPack}
              />
            ),
          agreement: (
            <div className="card">
              <p className="ck">Vendor IO</p>
              <h2 className="sec">Your agreement</h2>
              {detail.vendor_io_id ? (
                <>
                  <p className="note">
                    Terms for this campaign, including scope and payment.
                  </p>
                  <div className="money" style={{ marginTop: 14 }}>
                    <div>
                      <p className="l">Agreed fee</p>
                      <p className="v num">{money(detail.agreed_amount)}</p>
                    </div>
                    <div>
                      <p className="l">Status</p>
                      <p className="v">{detail.vendor_io_status?.replaceAll("_", " ") ?? "Draft"}</p>
                    </div>
                    <div>
                      <p className="l">Deliverables</p>
                      <p className="v num">{counts.total}</p>
                    </div>
                  </div>
                  {detail.vendor_io_document_number ? (
                    <p className="note" style={{ marginTop: 12 }}>
                      <DocumentNumber value={detail.vendor_io_document_number} />
                    </p>
                  ) : null}
                  {detail.vendor_io_payment_terms?.trim() ? (
                    <p className="note" style={{ marginTop: 8 }}>
                      Payment terms: {detail.vendor_io_payment_terms}
                    </p>
                  ) : null}
                  {detail.vendor_io_sent_at ? (
                    <p className="note">Sent {formatDate(detail.vendor_io_sent_at)}</p>
                  ) : null}
                  {detail.vendor_io_approved_at ? (
                    <p className="note">Accepted {formatDate(detail.vendor_io_approved_at)}</p>
                  ) : null}
                  {detail.vendor_io_rejection_reason ? (
                    <p className="note">{detail.vendor_io_rejection_reason}</p>
                  ) : null}
                  {detail.vendor_io_status === "sent" ? (
                    <div className="actions" style={{ marginTop: 14, display: "flex", gap: 8 }}>
                      <CreatorApproveVendorIoForm vendorIoId={detail.vendor_io_id} />
                      <CreatorRejectVendorIoForm vendorIoId={detail.vendor_io_id} />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="note">No agreement has been issued for this campaign yet.</p>
              )}
            </div>
          ),
          payment: payment ? (
            <div className="card">
              <p className="ck">Payment</p>
              <h2 className="sec">{detail.campaign_name}</h2>
              <p className="note">
                {creatorPaymentExplanationForRow(payment, {
                  vendorIoStatus: detail.vendor_io_status,
                  pendingDeliverables: counts.pending,
                })}{" "}
                Full history lives on{" "}
                <Link href="/creator-portal/payments" className="cw-link">
                  Payments
                </Link>
                .
              </p>
              <div style={{ marginTop: 14 }}>
                <CreatorMoneyStrip
                  agreed={money(payment.agreed_amount)}
                  invoiced={money(payment.invoiced_amount)}
                  paid={money(payment.paid_amount)}
                  pending={money(payment.pending_amount)}
                  pendingOutstanding={payment.pending_amount > 0}
                />
              </div>
            </div>
          ) : (
            <CreatorEmpty
              title="No payment record yet"
              description="Amounts appear here once this campaign assignment is in place."
            />
          ),
        }}
      />
    </div>
  );
}
