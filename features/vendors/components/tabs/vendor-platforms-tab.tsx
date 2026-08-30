"use client";

import type { ReactNode } from "react";

import { PlatformAccountsEditor } from "@/features/vendors/components/platform-accounts-editor";
import { VendorProfileTabShell } from "@/features/vendors/components/vendor-form-ui";
import type { VendorDetail } from "@/types/database";

export function VendorPlatformsTab({
  vendor,
  onCancel,
  creatorSocialPanel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
  creatorSocialPanel?: ReactNode;
}) {
  return (
    <VendorProfileTabShell
      title="Platforms"
      description="Social accounts, metrics, and enrichment for this creator."
      onCancel={onCancel}
    >
      {creatorSocialPanel}
      <PlatformAccountsEditor vendor={vendor} />
    </VendorProfileTabShell>
  );
}
