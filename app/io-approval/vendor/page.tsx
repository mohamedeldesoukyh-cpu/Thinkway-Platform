import { IoApprovalResultCard } from "@/features/io/components/io-approval-result-card";
import { completeVendorIoApprovalByToken } from "@/lib/io/complete-io-approval-by-token";
import type { IoApprovalOutcomeCode } from "@/lib/io/io-approval-outcomes";

type Props = {
  searchParams: Promise<{
    token?: string;
    email?: string;
  }>;
};

export default async function VendorIoApprovalPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  let outcome: IoApprovalOutcomeCode = "invalid";
  let documentNumber: string | null = null;

  if (token) {
    const result = await completeVendorIoApprovalByToken({
      token,
      approverEmail: params.email,
    });
    outcome = result.outcome;
    documentNumber = result.documentNumber ?? null;
  }

  return (
    <IoApprovalResultCard
      kindLabel="Vendor IO"
      outcome={outcome}
      documentNumber={documentNumber}
    />
  );
}
