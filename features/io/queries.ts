import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeOperationalQuery } from "@/lib/platform/safe-query";
import { devLog } from "@/lib/platform/logger";

import type {
  ClientIoRow,
  IoSearchFilters,
  VendorIoRow,
} from "@/features/io/types";

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
        .select(
          `
          id, campaign_header_id, client_id, status, terms_html, terms_text, billing_terms,
          attachment_url, sent_at, approved_at, approved_by_name, created_by, created_at, updated_at,
          campaign:campaign_headers!client_ios_campaign_header_id_fkey(document_number, name),
          client:clients!client_ios_client_id_fkey(name)
        `
        )
        .eq("id", clientIoId)
        .maybeSingle();

      if (error || !row) {
        throw new Error(error?.message ?? "Client IO not found.");
      }

      const typed = row as unknown as {
        id: string;
        campaign_header_id: string;
        client_id: string;
        status: ClientIoRow["status"];
        terms_html: string | null;
        terms_text: string | null;
        billing_terms: string | null;
        attachment_url: string | null;
        sent_at: string | null;
        approved_at: string | null;
        approved_by_name: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
        campaign: { document_number: string; name: string } | null;
        client: { name: string } | null;
      };

      return {
        id: typed.id,
        campaign_header_id: typed.campaign_header_id,
        campaign_name: typed.campaign?.name ?? "—",
        campaign_document_number: typed.campaign?.document_number ?? "—",
        client_id: typed.client_id,
        client_name: typed.client?.name ?? "—",
        status: typed.status,
        terms_html: typed.terms_html,
        terms_text: typed.terms_text,
        billing_terms: typed.billing_terms,
        attachment_url: typed.attachment_url,
        sent_at: typed.sent_at,
        approved_at: typed.approved_at,
        approved_by_name: typed.approved_by_name,
        created_by: typed.created_by,
        created_at: typed.created_at,
        updated_at: typed.updated_at,
      } satisfies ClientIoRow;
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
        .select(
          `
          id, assignment_id, campaign_header_id, influencer_id, amount, currency_code, status,
          terms_html, terms_text, usage_rights, exclusivity, attachment_url, sent_at, approved_at,
          approved_by_name, rejection_reason, created_by, created_at, updated_at,
          campaign:campaign_headers!vendor_ios_campaign_header_id_fkey(document_number, name),
          influencer:influencers!vendor_ios_influencer_id_fkey(display_name),
          assignment:campaign_influencers!vendor_ios_assignment_id_fkey(
            line:campaign_lines!campaign_influencers_campaign_line_id_fkey(document_number)
          )
        `
        )
        .eq("campaign_header_id", campaignHeaderId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          assignment_id: string;
          campaign_header_id: string;
          influencer_id: string;
          amount: number;
          currency_code: string;
          status: VendorIoRow["status"];
          terms_html: string | null;
          terms_text: string | null;
          usage_rights: string | null;
          exclusivity: string | null;
          attachment_url: string | null;
          sent_at: string | null;
          approved_at: string | null;
          approved_by_name: string | null;
          rejection_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          campaign: { document_number: string; name: string } | null;
          influencer: { display_name: string } | null;
          assignment: { line: { document_number: string } | null } | null;
        };

        return {
          id: typed.id,
          assignment_id: typed.assignment_id,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? "—",
          campaign_document_number: typed.campaign?.document_number ?? "—",
          assignment_document_number: typed.assignment?.line?.document_number ?? null,
          influencer_id: typed.influencer_id,
          influencer_name: typed.influencer?.display_name ?? "—",
          amount: Number(typed.amount),
          currency_code: typed.currency_code,
          status: typed.status,
          terms_html: typed.terms_html,
          terms_text: typed.terms_text,
          usage_rights: typed.usage_rights,
          exclusivity: typed.exclusivity,
          attachment_url: typed.attachment_url,
          sent_at: typed.sent_at,
          approved_at: typed.approved_at,
          approved_by_name: typed.approved_by_name,
          rejection_reason: typed.rejection_reason,
          created_by: typed.created_by,
          created_at: typed.created_at,
          updated_at: typed.updated_at,
        } satisfies VendorIoRow;
      });
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
        .select(
          `
          id, campaign_header_id, client_id, status, terms_html, terms_text, billing_terms,
          attachment_url, sent_at, approved_at, approved_by_name, created_by, created_at, updated_at,
          campaign:campaign_headers!client_ios_campaign_header_id_fkey(document_number, name),
          client:clients!client_ios_client_id_fkey(name)
        `
        )
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

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          campaign_header_id: string;
          client_id: string;
          status: ClientIoRow["status"];
          terms_html: string | null;
          terms_text: string | null;
          billing_terms: string | null;
          attachment_url: string | null;
          sent_at: string | null;
          approved_at: string | null;
          approved_by_name: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          campaign: { document_number: string; name: string } | null;
          client: { name: string } | null;
        };
        return {
          id: typed.id,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? "—",
          campaign_document_number: typed.campaign?.document_number ?? "—",
          client_id: typed.client_id,
          client_name: typed.client?.name ?? "—",
          status: typed.status,
          terms_html: typed.terms_html,
          terms_text: typed.terms_text,
          billing_terms: typed.billing_terms,
          attachment_url: typed.attachment_url,
          sent_at: typed.sent_at,
          approved_at: typed.approved_at,
          approved_by_name: typed.approved_by_name,
          created_by: typed.created_by,
          created_at: typed.created_at,
          updated_at: typed.updated_at,
        } satisfies ClientIoRow;
      });
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
        .select(
          `
          id, assignment_id, campaign_header_id, influencer_id, amount, currency_code, status,
          terms_html, terms_text, usage_rights, exclusivity, attachment_url, sent_at, approved_at,
          approved_by_name, rejection_reason, created_by, created_at, updated_at,
          campaign:campaign_headers!vendor_ios_campaign_header_id_fkey(document_number, name),
          influencer:influencers!vendor_ios_influencer_id_fkey(display_name),
          assignment:campaign_influencers!vendor_ios_assignment_id_fkey(
            line:campaign_lines!campaign_influencers_campaign_line_id_fkey(document_number)
          )
        `
        )
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

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          assignment_id: string;
          campaign_header_id: string;
          influencer_id: string;
          amount: number;
          currency_code: string;
          status: VendorIoRow["status"];
          terms_html: string | null;
          terms_text: string | null;
          usage_rights: string | null;
          exclusivity: string | null;
          attachment_url: string | null;
          sent_at: string | null;
          approved_at: string | null;
          approved_by_name: string | null;
          rejection_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          campaign: { document_number: string; name: string } | null;
          influencer: { display_name: string } | null;
          assignment: { line: { document_number: string } | null } | null;
        };

        return {
          id: typed.id,
          assignment_id: typed.assignment_id,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? "—",
          campaign_document_number: typed.campaign?.document_number ?? "—",
          assignment_document_number: typed.assignment?.line?.document_number ?? null,
          influencer_id: typed.influencer_id,
          influencer_name: typed.influencer?.display_name ?? "—",
          amount: Number(typed.amount),
          currency_code: typed.currency_code,
          status: typed.status,
          terms_html: typed.terms_html,
          terms_text: typed.terms_text,
          usage_rights: typed.usage_rights,
          exclusivity: typed.exclusivity,
          attachment_url: typed.attachment_url,
          sent_at: typed.sent_at,
          approved_at: typed.approved_at,
          approved_by_name: typed.approved_by_name,
          rejection_reason: typed.rejection_reason,
          created_by: typed.created_by,
          created_at: typed.created_at,
          updated_at: typed.updated_at,
        } satisfies VendorIoRow;
      });
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

