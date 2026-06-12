import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeOperationalQuery } from "@/lib/platform/safe-query";
import { devLog } from "@/lib/platform/logger";
import type {
  ClientIoRow,
  IoSearchFilters,
  VendorIoRow,
} from "@/features/io/types";
import { mapVendorIoQueryRow } from "@/features/io/vendor-io-row-map";
import { attachVendorIoUngenerateEligibility } from "@/features/io/vendor-io-query-helpers";

const VENDOR_IO_LIST_SELECT = `
  id, document_number, assignment_id, campaign_header_id, influencer_id, amount, currency_code, status,
  special_payment_terms,
  terms_html, terms_text, usage_rights, exclusivity, attachment_url,
  generated_html_url, generated_pdf_url, document_generated_at,
  sent_at, approved_at,
  approved_by_name, rejection_reason, created_by, created_at, updated_at,
  campaign:campaign_headers!vendor_ios_campaign_header_id_fkey(document_number, name),
  influencer:influencers!vendor_ios_influencer_id_fkey(display_name, payment_terms),
  assignment:campaign_influencers!vendor_ios_assignment_id_fkey(
    line:campaign_lines!campaign_influencers_campaign_line_id_fkey(document_number)
  )
`;

const CLIENT_IO_LIST_SELECT = `
  id, document_number, campaign_header_id, client_id, status, terms_html, terms_text, billing_terms,
  attachment_url, generated_html_url, generated_pdf_url, document_generated_at,
  sent_at, approved_at, approved_by_name, created_by, created_at, updated_at,
  campaign:campaign_headers!client_ios_campaign_header_id_fkey(document_number, name),
  client:clients!client_ios_client_id_fkey(name)
`;

function mapClientIoQueryRow(row: {
  id: string;
  document_number: string | null;
  campaign_header_id: string;
  client_id: string;
  status: ClientIoRow["status"];
  terms_html: string | null;
  terms_text: string | null;
  billing_terms: string | null;
  attachment_url: string | null;
  generated_html_url: string | null;
  generated_pdf_url: string | null;
  document_generated_at: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  campaign: { document_number: string; name: string } | null;
  client: { name: string } | null;
}): ClientIoRow {
  return {
    id: row.id,
    document_number: row.document_number,
    campaign_header_id: row.campaign_header_id,
    campaign_name: row.campaign?.name ?? "—",
    campaign_document_number: row.campaign?.document_number ?? "—",
    client_id: row.client_id,
    client_name: row.client?.name ?? "—",
    status: row.status,
    terms_html: row.terms_html,
    terms_text: row.terms_text,
    billing_terms: row.billing_terms,
    attachment_url: row.attachment_url,
    generated_html_url: row.generated_html_url,
    generated_pdf_url: row.generated_pdf_url,
    document_generated_at: row.document_generated_at,
    sent_at: row.sent_at,
    approved_at: row.approved_at,
    approved_by_name: row.approved_by_name,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
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

      const { data: row, error } = await supabase
        .from("client_ios")
        .select(CLIENT_IO_LIST_SELECT)
        .eq("id", clientIoId)
        .maybeSingle();

      if (error || !row) {
        throw new Error(error?.message ?? "Client IO not found.");
      }

      return mapClientIoQueryRow(row as never);
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

      return attachVendorIoUngenerateEligibility(supabase, mapped);
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
      let query = supabase
        .from("client_ios")
        .select(CLIENT_IO_LIST_SELECT)
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.q?.trim()) {
        const pattern = `%${escapeIlikePattern(filters.q.trim())}%`;
        query = query.or(`terms_text.ilike.${pattern},billing_terms.ilike.${pattern}`);
      }

      const { data, error } = await query.limit(200);
      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as unknown[]).map((row) => mapClientIoQueryRow(row as never));
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

      return attachVendorIoUngenerateEligibility(supabase, mapped);
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

