import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientIoRow } from "@/lib/domains/io/types";
import { parseSendRecipientsJson } from "@/lib/io/client-io-send-recipients";

export const CLIENT_IO_LIST_SELECT = `
  id, document_number, campaign_header_id, client_id, status, terms_html, terms_text, billing_terms,
  attachment_url, generated_html_url, generated_pdf_url, document_generated_at,
  sent_at, approved_at, approved_by_name, send_recipients, created_by, created_at, updated_at,
  campaign:campaign_headers!client_ios_campaign_header_id_fkey(document_number, name, brand:brands(name)),
  client:clients!client_ios_client_id_fkey(name, client_io_terms_text)
`;

export const CLIENT_IO_LEGACY_SELECT = `
  id, campaign_header_id, client_id, status, terms_html, terms_text, billing_terms,
  attachment_url, sent_at, approved_at, approved_by_name, created_by, created_at, updated_at,
  campaign:campaign_headers!client_ios_campaign_header_id_fkey(document_number, name, brand:brands(name)),
  client:clients!client_ios_client_id_fkey(name)
`;

type ClientIoQueryRow = {
  id: string;
  document_number?: string | null;
  campaign_header_id: string;
  client_id: string;
  status: ClientIoRow["status"];
  terms_html: string | null;
  terms_text: string | null;
  billing_terms: string | null;
  attachment_url: string | null;
  generated_html_url?: string | null;
  generated_pdf_url?: string | null;
  document_generated_at?: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  send_recipients?: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  campaign:
    | { document_number: string; name: string; brand: { name: string } | Array<{ name: string }> | null }
    | null;
  client: { name: string; client_io_terms_text?: string | null } | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function mapClientIoQueryRow(row: ClientIoQueryRow): ClientIoRow {
  const brand = unwrapRelation(row.campaign?.brand ?? null);
  return {
    id: row.id,
    document_number: row.document_number ?? null,
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
    generated_html_url: row.generated_html_url ?? null,
    generated_pdf_url: row.generated_pdf_url ?? null,
    document_generated_at: row.document_generated_at ?? null,
    sent_at: row.sent_at,
    approved_at: row.approved_at,
    approved_by_name: row.approved_by_name,
    brand_name: brand?.name ?? null,
    client_io_terms_text: row.client?.client_io_terms_text ?? null,
    send_recipients: parseSendRecipientsJson(row.send_recipients),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isClientIoSchemaMismatch(message: string): boolean {
  const normalized = message.toLowerCase();
  if (!normalized.includes("does not exist")) {
    return false;
  }

  return (
    normalized.includes("document_number") ||
    normalized.includes("document_generated_at") ||
    normalized.includes("generated_html_url") ||
    normalized.includes("generated_pdf_url") ||
    normalized.includes("send_recipients")
  );
}

export async function fetchClientIoRow(
  supabase: SupabaseClient,
  clientIoId: string
): Promise<ClientIoRow | null> {
  const full = await supabase
    .from("client_ios")
    .select(CLIENT_IO_LIST_SELECT)
    .eq("id", clientIoId)
    .maybeSingle();

  if (!full.error && full.data) {
    return mapClientIoQueryRow(full.data as unknown as ClientIoQueryRow);
  }

  if (full.error && !isClientIoSchemaMismatch(full.error.message)) {
    throw new Error(full.error.message);
  }

  const legacy = await supabase
    .from("client_ios")
    .select(CLIENT_IO_LEGACY_SELECT)
    .eq("id", clientIoId)
    .maybeSingle();

  if (legacy.error) {
    throw new Error(legacy.error.message);
  }

  if (!legacy.data) {
    return null;
  }

  return mapClientIoQueryRow(legacy.data as unknown as ClientIoQueryRow);
}

export async function fetchClientIoRows(
  supabase: SupabaseClient,
  options?: {
    campaignHeaderId?: string;
    clientId?: string;
    limit?: number;
    status?: string;
    searchPattern?: string;
  }
): Promise<ClientIoRow[]> {
  const runQuery = async (select: string) => {
    let query = supabase.from("client_ios").select(select).order("created_at", { ascending: false });

    if (options?.campaignHeaderId) {
      query = query.eq("campaign_header_id", options.campaignHeaderId);
    }

    if (options?.clientId) {
      query = query.eq("client_id", options.clientId);
    }

    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    if (options?.searchPattern) {
      query = query.or(
        `terms_text.ilike.${options.searchPattern},billing_terms.ilike.${options.searchPattern}`
      );
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query;
  };

  const full = await runQuery(CLIENT_IO_LIST_SELECT);
  if (!full.error) {
    return ((full.data ?? []) as unknown as ClientIoQueryRow[]).map(mapClientIoQueryRow);
  }

  if (!isClientIoSchemaMismatch(full.error.message)) {
    throw new Error(full.error.message);
  }

  const legacy = await runQuery(CLIENT_IO_LEGACY_SELECT);
  if (legacy.error) {
    throw new Error(legacy.error.message);
  }

  return ((legacy.data ?? []) as unknown as ClientIoQueryRow[]).map(mapClientIoQueryRow);
}
