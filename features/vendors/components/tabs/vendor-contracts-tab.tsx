import { VendorLegalTab } from "@/features/vendors/components/tabs/vendor-legal-tab";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorContractsTab({ vendor }: { vendor: VendorWorkspace }) {
  return <VendorLegalTab vendor={vendor} />;
}
