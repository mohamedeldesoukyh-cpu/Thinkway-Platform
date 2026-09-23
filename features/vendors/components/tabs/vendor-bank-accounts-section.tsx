"use client";

import { CrmAaibBankEditor } from "@/features/creator-payments/bank-editor";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorBankAccountsSection({ workspace }: { workspace: VendorWorkspace }) {
  return (
    <CrmAaibBankEditor
      creatorId={workspace.id}
      creatorName={workspace.display_name}
      details={(workspace.payment_details ?? {}) as Record<string, unknown>}
    />
  );
}
