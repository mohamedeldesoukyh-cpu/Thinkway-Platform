"use client";

import { PlatformAccountsEditor } from "@/features/vendors/components/platform-accounts-editor";
import type { VendorDetail } from "@/types/database";

export function VendorPlatformsTab({ vendor }: { vendor: VendorDetail }) {
  return <PlatformAccountsEditor vendor={vendor} />;
}
