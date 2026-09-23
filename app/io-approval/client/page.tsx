import { ClientIoApprovalConfirmation } from "@/features/io/components/client-io-approval-confirmation";
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

  if (token && !params.email) return <ClientIoApprovalConfirmation token={token} />;

  let outcome: IoApprovalOutcomeCode = "invalid";
  let documentNumber: string | null = null;
  let confirmationEmailSent: boolean | undefined;

  if (token) {
    const result = await completeClientIoApprovalByToken({
      token,
      approverEmail: params.email,
    });
    outcome = result.outcome;
    documentNumber = result.documentNumber ?? null;
    confirmationEmailSent = result.ok ? result.confirmationEmailSent : undefined;
  }

  return (
    <IoApprovalResultCard
      kindLabel="Client IO"
      outcome={outcome}
      documentNumber={documentNumber}
      confirmationEmailSent={confirmationEmailSent}
    />
  );
}
