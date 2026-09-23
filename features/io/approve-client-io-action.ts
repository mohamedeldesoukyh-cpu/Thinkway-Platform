"use server";

import { completeClientIoApprovalByToken, type OneClickApprovalResult } from "@/lib/io/complete-io-approval-by-token";
import { isValidClientIoEmail } from "@/lib/io/client-io-send-recipients";

export async function confirmClientIoApprovalAction(
  _previous: { result?: OneClickApprovalResult; message?: string },
  formData: FormData
): Promise<{ result?: OneClickApprovalResult; message?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  if (!token || !isValidClientIoEmail(email)) return { message: "Enter your email address to confirm approval." };
  return { result: await completeClientIoApprovalByToken({ token, approverEmail: email }) };
}
