import { IoApprovalResultCard } from "@/features/io/components/io-approval-result-card";
import { completeClientIoApprovalByToken } from "@/lib/io/complete-io-approval-by-token";
import type { IoApprovalOutcomeCode } from "@/lib/io/io-approval-outcomes";

type Props = {
  searchParams: Promise<{
    token?: string;
    email?: string;
  }>;
};

export default async function ClientIoApprovalPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  let outcome: IoApprovalOutcomeCode = "invalid";
  let documentNumber: string | null = null;

  if (token) {
    const result = await completeClientIoApprovalByToken({
      token,
      approverEmail: params.email,
    });
    outcome = result.outcome;
    documentNumber = result.documentNumber ?? null;
  }

  return (
    <IoApprovalResultCard
      kindLabel="Client IO"
      outcome={outcome}
      documentNumber={documentNumber}
    />
  );
}
