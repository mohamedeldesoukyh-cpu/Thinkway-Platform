"use server";

import { headers } from "next/headers";

import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { isValidClientIoEmail } from "@/lib/io/client-io-send-recipients";
import { buildClientReviewEmail } from "@/lib/email/client-review-email";
import { assertOutboundEmailReady, sendEmail } from "@/lib/email/provider";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { createClientReviewFromQuotation } from "../create-from-quotation";

export async function sendClientReviewEmailAction(input: {
  quotationId: string;
  emails: string[];
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  let userId: string;
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) return { ok: false, message: auth.error };
    userId = adminAuth.userId;
  } else {
    userId = auth.userId;
  }

  const emails = [
    ...new Set(
      input.emails.map((email) => email.trim()).filter((email) => isValidClientIoEmail(email))
    ),
  ];
  if (emails.length === 0) {
    return { ok: false, message: "Select at least one client email." };
  }

  const mailReady = assertOutboundEmailReady();
  if (!mailReady.ok) return { ok: false, message: mailReady.message };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com";

  const result = await createClientReviewFromQuotation(supabase, {
    quotationId: input.quotationId,
    userId,
    origin,
  });
  if (!result.ok) return { ok: false, message: result.message };

  const quotation = await getQuotationDetail(
    supabase as import("@supabase/supabase-js").SupabaseClient<Database>,
    input.quotationId
  );
  const brandName = quotation?.brand_name || quotation?.temporary_brand_name || "Brand";
  const clientLabel = quotation?.client_name || quotation?.temporary_client_name || brandName;
  const campaignName = quotation?.campaign_name || quotation?.name || "Campaign proposal";
  const email = buildClientReviewEmail({
    clientLabel,
    brandName,
    campaignName,
    reviewUrl: result.url,
    updates: result.updates,
  });

  const sent = await sendEmail({
    to: emails.map((address) => ({ email: address })),
    subject: email.subject,
    html: email.html,
    text: email.plainText,
  });
  if (!sent.ok) return { ok: false, message: sent.error };

  return {
    ok: true,
    message: emails.length === 1 ? "Sent to the client." : `Sent to ${emails.length} recipients.`
  };
}
