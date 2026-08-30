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
        <CardContent className="p-5">
          <p className="text-sm font-medium">You are all caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When something needs your attention, it will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {actions.map((action) => (
        <Card key={action.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{action.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{action.description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {action.kind === "vendor_io" && action.vendorIoId ? (
              <div className="space-y-2">
                <CreatorApproveVendorIoForm vendorIoId={action.vendorIoId} />
                <CreatorRejectVendorIoForm vendorIoId={action.vendorIoId} />
              </div>
            ) : null}
            <Button asChild variant={action.kind === "vendor_io" ? "outline" : "default"} className="w-full sm:w-auto">
              <Link href={action.href}>
                {action.kind === "vendor_io"
                  ? "Open campaign"
                  : action.kind === "payment"
                    ? "View payments"
                    : "Continue"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
