"use client";

import { VendorLegalTab } from "@/features/vendors/components/tabs/vendor-legal-tab";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorContractsTab({
  vendor,
  onCancel,
  shortcutsEnabled = true,
}: {
  vendor: VendorWorkspace;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  return (
    <VendorLegalTab
      vendor={vendor}
      onCancel={onCancel}
      shortcutsEnabled={shortcutsEnabled}
    />
  );
}
