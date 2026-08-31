import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreatorHomeNextAction } from "@/features/creator-workspace/home-next-actions";
import { CreatorApproveVendorIoForm } from "@/features/portals/components/creator-approve-vendor-io-form";
import { CreatorRejectVendorIoForm } from "@/features/portals/components/creator-reject-vendor-io-form";

export function CreatorHomeNextActionList({
  actions,
}: {
  actions: CreatorHomeNextAction[];
}) {
  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="p-3">
          <p className="text-sm font-medium">You're all caught up.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When something needs your attention, it will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-2">
      {actions.map((action) => (
        <Card key={action.id}>
          <CardHeader className="space-y-1 px-3 pb-2 pt-3">
            <CardTitle className="text-sm">{action.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{action.description}</p>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3">
            {action.kind === "vendor_io" && action.vendorIoId ? (
              <div className="space-y-2">
                <CreatorApproveVendorIoForm vendorIoId={action.vendorIoId} />
                <CreatorRejectVendorIoForm vendorIoId={action.vendorIoId} />
              </div>
            ) : null}
            <Button asChild variant={action.kind === "vendor_io" ? "outline" : "default"} className="w-full sm:w-auto">
              <Link href={action.href}>
                {action.kind === "vendor_io"
                  ? "Review agreement"
                  : action.kind === "payment"
                    ? "View payment"
                    : action.kind === "changes_requested"
                      ? "Review changes"
                      : action.kind === "publication"
                        ? "Submit publication link"
                        : action.kind === "deliverable"
                          ? "Open deliverable"
                          : "Continue"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
