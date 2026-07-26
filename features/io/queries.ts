import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeOperationalQuery } from "@/lib/platform/safe-query";
import { devLog } from "@/lib/platform/logger";
import type {
  ClientIoRow,
  ClientIoSendHistoryEntry,
  ClientIoSendRecipient,
  IoSearchFilters,
  VendorIoRow,
} from "@/features/io/types";
import { mapVendorIoQueryRow } from "@/features/io/vendor-io-row-map";
import { attachVendorIoUngenerateEligibility } from "@/features/io/vendor-io-query-helpers";
import { attachInfluencerAvatarsToVendorIoRows } from "@/lib/creators/influencer-avatar-meta";
import { fetchClientIoRow, fetchClientIoRows } from "@/lib/io/client-io-query";

const VENDOR_IO_LIST_SELECT = `
  id, document_number, assignment_id, campaign_header_id, influencer_id, amount, currency_code, status,
  special_payment_terms,
  terms_html, terms_text, usage_rights, exclusivity, attachment_url,
  generated_html_url, generated_pdf_url, document_generated_at,
  sent_at, approved_at,
  approved_by_name, rejection_reason, created_by, created_at, updated_at,
  campaign:campaign_headers!vendor_ios_campaign_header_id_fkey(document_number, name),
  influencer:influencers!vendor_ios_influencer_id_fkey(display_name, payment_terms, vendor_io_terms_text),
  assignment:campaign_influencers!vendor_ios_assignment_id_fkey(
    line:campaign_lines!campaign_influencers_campaign_line_id_fkey(document_number)
  )
`;

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return { supabase, user };
}

export async function getClientIoSendHistory(
  clientIoId: string
): Promise<ClientIoSendHistoryEntry[]> {
  const result = await safeOperationalQuery(
    "io:getClientIoSendHistory",
    async () => {
      const { supabase } = await requireUser();

      const { data, error } = await supabase
        .from("io_notifications")
        .select(
          "id, recipient_email, recipient_name, sender_email, subject, delivery_status, delivery_error, sent_at, created_at, sent_by, send_batch_id, payload"
        )
        .eq("io_type", "client")
        .eq("io_id", clientIoId)
        .eq("event_type", "client_io_sent")
        .not("recipient_email", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<{
        id: string;
        recipient_email: string | null;
        recipient_name: string | null;
        sender_email: string | null;
        subject: string | null;
        delivery_status: string | null;
        delivery_error: string | null;
        sent_at: string | null;
        created_at: string;
        sent_by: string | null;
        send_batch_id: string | null;
        payload: Record<string, unknown> | null;
      }>;

      const actorIds = [
        ...new Set(rows.map((row) => row.sent_by).filter((id): id is string => Boolean(id))),
      ];

      const profileMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", actorIds);
        for (const profile of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
          profileMap.set(profile.id, profile.full_name?.trim() || "User");
        }
      }

      return rows.map((row) => {
        const payload = row.payload ?? {};
        const emailHtml =
          typeof payload.email_html === "string" ? payload.email_html : null;
        const emailText =
          typeof payload.email_text === "string" ? payload.email_text : null;
        const sentByDisplayName =
          typeof payload.sender_display_name === "string"
            ? payload.sender_display_name
            : null;

        return {
          id: row.id,
          recipient_email: row.recipient_email,
          recipient_name: row.recipient_name,
          sender_email: row.sender_email,
          subject: row.subject,
          delivery_status: row.delivery_status,
          delivery_error: row.delivery_error,
          sent_at: row.sent_at,
          created_at: row.created_at,
          sent_by_name: row.sent_by ? (profileMap.get(row.sent_by) ?? null) : null,
          send_batch_id: row.send_batch_id,
          email_html: emailHtml,
          email_text: emailText,
          sent_by_display_name: sentByDisplayName,
        };
      });
    },
    []
  );

  return result.data;
}

export async function getClientIoSendRecipients(
  clientId: string
): Promise<ClientIoSendRecipient[]> {
  const result = await safeOperationalQuery(
    "io:getClientIoSendRecipients",
    async () => {
      const { supabase } = await requireUser();

      const [contactsResult, clientResult] = await Promise.all([
        supabase
          .from("client_contacts")
          .select("id, full_name, email, is_primary")
          .eq("client_id", clientId)
          .order("is_primary", { ascending: false })
          .order("full_name"),
        supabase.from("clients").select("billing_email, name").eq("id", clientId).maybeSingle(),
      ]);

      if (contactsResult.error) {
        throw new Error(contactsResult.error.message);
      }
      if (clientResult.error) {
        throw new Error(clientResult.error.message);
      }

      const recipients: ClientIoSendRecipient[] = [];
      const seen = new Set<string>();

      for (const contact of (contactsResult.data ?? []) as Array<{
        id: string;
        full_name: string;
        email: string | null;
        is_primary: boolean;
      }>) {
        const email = String(contact.email ?? "").trim();
        if (!email || seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());
        recipients.push({
          id: String(contact.id),
          label: contact.is_primary ? `${contact.full_name} (Primary)` : contact.full_name,
          email,
        });
      }

      const clientRow = clientResult.data as { billing_email: string | null; name: string } | null;
      const billingEmail = String(clientRow?.billing_email ?? "").trim();
      if (billingEmail && !seen.has(billingEmail.toLowerCase())) {
        recipients.unshift({
          id: "billing-email",
          label: `${clientRow?.name ?? "Client"} billing`,
          email: billingEmail,
        });
      }

      return recipients;
    },
    []
  );

  return result.data;
}

export async function getCampaignClientIo(campaignHeaderId: string): Promise<ClientIoRow | null> {
  const result = await safeOperationalQuery(
    "io:getCampaignClientIo",
    async () => {
      const { supabase, user } = await requireUser();
      const { data } = await (supabase as any).rpc("ensure_client_io_for_campaign", {
        p_campaign_header_id: campaignHeaderId,
        p_actor_id: user.id,
      });

      const clientIoId = data as string | null;
      if (!clientIoId) {
        return null;
      }

      const row = await fetchClientIoRow(supabase, clientIoId);
      if (!row) {
        throw new Error("Client IO not found.");
      }

      return row;
    },
    null
  );

  return result.data;
}

export async function getCampaignVendorIos(campaignHeaderId: string): Promise<VendorIoRow[]> {
  const result = await safeOperationalQuery(
    "io:getCampaignVendorIos",
    async () => {
      const { supabase } = await requireUser();
      const { data, error } = await supabase
        .from("vendor_ios")
        .select(VENDOR_IO_LIST_SELECT)
        .eq("campaign_header_id", campaignHeaderId)
        .eq("is_superseded", false)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const mapped = ((data ?? []) as unknown[]).map((row) => mapVendorIoQueryRow(row as never));

      const withEligibility = await attachVendorIoUngenerateEligibility(supabase, mapped);
      return attachInfluencerAvatarsToVendorIoRows(supabase, withEligibility);
    },
    []
  );

  return result.data;
}

export async function getClientIos(filters: IoSearchFilters): Promise<ClientIoRow[]> {
  const result = await safeOperationalQuery(
    "io:getClientIos",
    async () => {
      const { supabase } = await requireUser();
      const pattern = filters.q?.trim()
        ? `%${escapeIlikePattern(filters.q.trim())}%`
        : undefined;

      return fetchClientIoRows(supabase, {
        clientId: filters.clientId,
        status: filters.status,
        searchPattern: pattern,
        limit: 200,
      });
    },
    []
  );

  return result.data;
}

export async function getClientIosForClient(clientId: string): Promise<ClientIoRow[]> {
  const result = await safeOperationalQuery(
    "io:getClientIosForClient",
    async () => {
      const { supabase } = await requireUser();
      return fetchClientIoRows(supabase, { clientId, limit: 500 });
    },
    []
  );

  return result.data;
}

export async function getVendorIos(filters: IoSearchFilters): Promise<VendorIoRow[]> {
  const result = await safeOperationalQuery(
    "io:getVendorIos",
    async () => {
      const { supabase } = await requireUser();
      let query = supabase
        .from("vendor_ios")
        .select(VENDOR_IO_LIST_SELECT)
        .eq("is_superseded", false)
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.q?.trim()) {
        const pattern = `%${escapeIlikePattern(filters.q.trim())}%`;
        query = query.or(
          `terms_text.ilike.${pattern},usage_rights.ilike.${pattern},exclusivity.ilike.${pattern}`
        );
      }

      const { data, error } = await query.limit(200);
      if (error) {
        throw new Error(error.message);
      }

      const mapped = ((data ?? []) as unknown[]).map((row) => mapVendorIoQueryRow(row as never));

      const withEligibility = await attachVendorIoUngenerateEligibility(supabase, mapped);
      return attachInfluencerAvatarsToVendorIoRows(supabase, withEligibility);
    },
    []
  );

  return result.data;
}

export function buildIoEmailLink(type: "client" | "vendor", token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/io-approval/${type}?token=${encodeURIComponent(token)}`;
}

export async function ensureVendorIoFromAssignment(assignmentId: string): Promise<string | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await (supabase as any).rpc("upsert_vendor_io_from_assignment", {
    p_assignment_id: assignmentId,
    p_actor_id: user.id,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data as string | null) ?? null;
}

export function debugIo(scope: "client-io" | "vendor-io" | "io-email" | "io-approval", message: string, detail?: unknown) {
  devLog(`[${scope}]`, message, detail);
}

