import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatorApproveVendorIoForm } from "@/features/portals/components/creator-approve-vendor-io-form";
import { CreatorRejectVendorIoForm } from "@/features/portals/components/creator-reject-vendor-io-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { CreatorCampaignMessages } from "@/features/creator-workspace/components/creator-campaign-messages";
import { CreatorCampaignProgress } from "@/features/creator-workspace/components/creator-campaign-progress";
import { CreatorCampaignScripts } from "@/features/creator-workspace/components/creator-campaign-scripts";
import { CreatorCampaignTabs } from "@/features/creator-workspace/components/creator-campaign-tabs";
import { CreatorDocumentationUnitList } from "@/features/creator-workspace/components/creator-documentation-unit-list";
import { CreatorProfilePayments } from "@/features/creator-workspace/components/creator-profile-payments";
import {
  creatorCampaignUnitCounts,
  projectCreatorCampaignStage,
} from "@/features/creator-workspace/campaign-progress";
import { campaignCreatorActionLine } from "@/features/creator-workspace/campaign-card-model";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import { creatorPaymentExplanationForRow } from "@/features/creator-workspace/payment-copy";
import { unitNeedsPublicationLink } from "@/features/creator-workspace/unit-status";
import type {
  CreatorCampaignDetail,
  CreatorCampaignRow,
  CreatorPaymentRow,
  CreatorPublicationRow,
} from "@/features/portals/types";
import { formatMoneyDetail } from "@/lib/finance/currency-format";
import type { CreatorInsightPack } from "@/lib/creator-insights/types";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function CreatorCampaignWorkspace({
  detail,
  units,
  payment,
  publications,
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
  const nextAction = campaignCreatorActionLine(
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
      publication_total: publications.length,
      recent_publication_status: null,
      publication_needed: units.filter((unit) => unitNeedsPublicationLink(unit)).length,
    }
  );

  return (
    <div className="space-y-4">
      <PageBackButton
        fallbackHref="/creator-portal/campaigns"
        label="Back to campaigns"
        variant="text"
      />

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {detail.campaign_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            <DocumentNumber value={detail.campaign_document_number} />
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <PortalStatusBadge value={detail.campaign_status} />
            <PortalStatusBadge value={detail.assignment_status} />
          </div>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border px-3 py-2">
            <dt className="text-xs text-muted-foreground">Dates</dt>
            <dd className="text-sm font-medium">
              {formatDate(detail.start_date)} → {formatDate(detail.end_date)}
            </dd>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <dt className="text-xs text-muted-foreground">Agreed fee</dt>
            <dd className="text-sm font-medium">
              {formatMoneyDetail(detail.agreed_amount, detail.currency_code)}
            </dd>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <dt className="text-xs text-muted-foreground">Progress</dt>
            <dd className="text-sm font-medium">
              {counts.total === 0
                ? "No deliverables yet"
                : `${counts.completed} of ${counts.total} complete`}
            </dd>
          </div>
          <div className="rounded-lg border border-border px-3 py-2">
            <dt className="text-xs text-muted-foreground">Next action</dt>
            <dd className="text-sm font-medium">{nextAction}</dd>
          </div>
        </dl>
      </div>

      <CreatorCampaignTabs
        sections={{
          overview: (
            <div className="space-y-4">
              <CreatorCampaignProgress stage={stage} />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <OverviewStat label="Deliverables" value={String(counts.total)} />
                <OverviewStat label="Completed" value={String(counts.completed)} />
                <OverviewStat label="Pending" value={String(counts.pending)} />
                <OverviewStat label="Approved" value={String(counts.approved)} />
                <OverviewStat label="Published" value={String(counts.published)} />
                <OverviewStat
                  label="Payment"
                  value={payment?.payment_status ?? "Pending"}
                />
              </div>
            </div>
          ),
          brief: (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign brief</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {detail.brief?.trim() || "No brief provided."}
                </p>
                <p className="text-muted-foreground">
                  {formatDate(detail.start_date)} → {formatDate(detail.end_date)}
                </p>
              </CardContent>
            </Card>
          ),
          script: <CreatorCampaignScripts units={units} />,
          deliverables: (
            <CreatorDocumentationUnitList
              units={units}
              showCampaignLink={false}
              hideScript
              insightPack={insightPack}
            />
          ),
          agreement: (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agreement / Vendor IO</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {detail.vendor_io_id ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <PortalStatusBadge value={detail.vendor_io_status ?? "draft"} />
                      {detail.vendor_io_document_number ? (
                        <DocumentNumber value={detail.vendor_io_document_number} />
                      ) : null}
                    </div>
                    <p>
                      Agreed amount:{" "}
                      {formatMoneyDetail(detail.agreed_amount, detail.currency_code)}
                    </p>
                    <p>
                      Campaign dates: {formatDate(detail.start_date)} →{" "}
                      {formatDate(detail.end_date)}
                    </p>
                    <p>
                      Deliverables covered: {counts.total}
                    </p>
                    {detail.vendor_io_payment_terms?.trim() ? (
                      <p>Payment terms: {detail.vendor_io_payment_terms}</p>
                    ) : (
                      <p className="text-muted-foreground">No special payment terms on this agreement.</p>
                    )}
                    {detail.vendor_io_sent_at ? (
                      <p className="text-muted-foreground">
                        Sent {formatDate(detail.vendor_io_sent_at)}
                      </p>
                    ) : null}
                    {detail.vendor_io_approved_at ? (
                      <p className="text-muted-foreground">
                        Accepted {formatDate(detail.vendor_io_approved_at)}
                      </p>
                    ) : null}
                    {detail.vendor_io_rejection_reason ? (
                      <p className="text-muted-foreground">
                        {detail.vendor_io_rejection_reason}
                      </p>
                    ) : null}
                    {detail.vendor_io_status === "sent" && detail.vendor_io_id ? (
                      <div className="flex flex-col gap-2 pt-2">
                        <CreatorApproveVendorIoForm vendorIoId={detail.vendor_io_id} />
                        <CreatorRejectVendorIoForm vendorIoId={detail.vendor_io_id} />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No agreement has been issued for this campaign yet.
                  </p>
                )}
              </CardContent>
            </Card>
          ),
          publications: (
            <div className="space-y-3">
              {publications.length === 0 &&
              units.every((unit) => !unit.publicationUrl) ? (
                <p className="rounded-lg border border-border px-4 py-5 text-center text-sm text-muted-foreground">
                  This campaign has not been published yet.
                </p>
              ) : (
                <CreatorDocumentationUnitList
                  units={units.filter((unit) => unit.expectsPublicationUrl)}
                  showCampaignLink={false}
                  hideScript
                />
              )}
            </div>
          ),
          payment: payment ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {creatorPaymentExplanationForRow(payment, {
                  vendorIoStatus: detail.vendor_io_status,
                  pendingDeliverables: counts.pending,
                })}
              </p>
              <CreatorProfilePayments rows={[payment]} />
            </div>
          ) : (
            <p className="rounded-lg border border-border px-4 py-5 text-center text-sm text-muted-foreground">
              No payment record for this campaign yet.
            </p>
          ),
          messages: <CreatorCampaignMessages units={units} />,
        }}
      />
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
