import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientPoUploadForm } from "@/features/portals/components/client-po-upload-form";
import { ClientIoTable } from "@/features/portals/components/tables/client-io-table";
import { getClientIosList } from "@/features/portals/queries";

export default async function ClientPortalClientIoPage() {
  const rows = await getClientIosList();

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-4">
        <ClientIoTable rows={rows} />

        <Card>
          <CardHeader>
            <CardTitle>Upload campaign PO</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {rows.slice(0, 3).map((row) => (
              <ClientPoUploadForm key={row.id} campaignHeaderId={row.campaign_header_id} />
            ))}
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaign context yet for PO upload.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PlatformErrorBoundary>
  );
}
