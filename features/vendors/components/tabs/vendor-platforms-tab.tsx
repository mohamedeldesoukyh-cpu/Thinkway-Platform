"use client";

import { PlatformAccountsEditor } from "@/features/vendors/components/platform-accounts-editor";
import { VendorProfileTabShell } from "@/features/vendors/components/vendor-form-ui";
import type { VendorDetail } from "@/types/database";

export function VendorPlatformsTab({
  vendor,
  onCancel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
}) {
  return (
    <VendorProfileTabShell
      title="Platforms"
      description="Social accounts, metrics, and enrichment for this creator."
      onCancel={onCancel}
    >
      <PlatformAccountsEditor vendor={vendor} />
    </VendorProfileTabShell>
  );
}
