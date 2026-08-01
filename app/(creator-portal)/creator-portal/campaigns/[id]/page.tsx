import { notFound } from "next/navigation";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatorDeliverableRowPanel } from "@/features/portals/components/creator-deliverable-row";
import {
  CreatorApproveVendorIoForm,
} from "@/features/portals/components/creator-approve-vendor-io-form";
import { CreatorRejectVendorIoForm } from "@/features/portals/components/creator-reject-vendor-io-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getCreatorCampaignDetail } from "@/features/portals/queries";
import { formatMoneyDetail } from "@/lib/finance/currency-format";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CreatorCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const detail = await getCreatorCampaignDetail(id);

  if (!detail) {
    notFound();
  }

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-6">
        <PageBackButton
          fallbackHref="/creator-portal/campaigns"
          label="Back to campaigns"
          variant="text"
        />

        <div className="space-y-1">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{detail.brief?.trim() || "No brief provided."}</p>
              <p>
                {detail.start_date
                  ? new Date(detail.start_date).toLocaleDateString()
                  : "—"}{" "}
                →{" "}
                {detail.end_date
                  ? new Date(detail.end_date).toLocaleDateString()
                  : "—"}
              </p>
              <p>
                Agreed fee:{" "}
                {formatMoneyDetail(detail.agreed_amount, detail.currency_code)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor IO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PortalStatusBadge value={detail.vendor_io_status ?? "draft"} />
              {detail.vendor_io_status === "sent" && detail.vendor_io_id ? (
                <div className="flex flex-col gap-2">
                  <CreatorApproveVendorIoForm vendorIoId={detail.vendor_io_id} />
                  <CreatorRejectVendorIoForm vendorIoId={detail.vendor_io_id} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deliverables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.deliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliverables assigned.</p>
            ) : (
              detail.deliverables.map((deliverable) => (
                <CreatorDeliverableRowPanel
                  key={deliverable.id}
                  deliverable={deliverable}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformErrorBoundary>
  );
}
