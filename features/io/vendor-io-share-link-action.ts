"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { currentVendorSigningToken } from "@/lib/io/vendor-io-share-link";
import { buildIoEmailLink } from "./queries";

export async function getVendorIoShareLink(id: string): Promise<{ url?: string; message?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { message: "Invalid IO." };
  const db = await createSupabaseServerClient();
  const auth = await requirePermission(db, "vendor_ios.write");
  if ("error" in auth) return { message: auth.error };
  const { data: io, error } = await db.from("vendor_ios")
    .select("status,is_superseded,approval_token_hash,approval_token_expires_at")
    .eq("id", id).maybeSingle();
  if (error || !io) return { message: "This IO is not available." };
  const { data: notices, error: noticesError } = await db.from("io_notifications")
    .select("payload").eq("io_type", "vendor").eq("io_id", id)
    .eq("event_type", "vendor_io_sent").eq("delivery_status", "sent")
    .order("sent_at", { ascending: false, nullsFirst: false }).limit(50);
  if (noticesError) return { message: "Could not load the sent link. Please try again." };
  const token = currentVendorSigningToken(io, (notices ?? []).map(n => n.payload));
  if (!token) return { message: "No active emailed signing link. Send or resend this IO first. Approved, expired or superseded links cannot be shared for signing." };
  // Use the same active credential as the email without exposing old deployment hosts.
  return { url: buildIoEmailLink("vendor", token) };
}
