import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";

export type CreatorDeleteLinkRef = {
  kind:
    | "campaign"
    | "shortlist"
    | "quotation"
    | "deliverable"
    | "vendor_io"
    | "publication"
    | "invoice";
  id: string;
  reference: string;
  name: string | null;
};

export type CreatorDeleteBlockersResult = {
  canDelete: boolean;
  links: CreatorDeleteLinkRef[];
  message: string;
};

function blockerMessage(links: CreatorDeleteLinkRef[]): string {
  if (links.length === 0) {
    return "Ready to delete.";
  }
  return "This creator is linked to operational records. Remove those links before deleting.";
}

export async function getCreatorDeleteBlockers(
  supabase: SupabaseClient,
  influencerId: string
): Promise<CreatorDeleteBlockersResult> {
  const links: CreatorDeleteLinkRef[] = [];

  const [
    assignmentsRes,
    shortlistItemsRes,
    quotationItemsRes,
    deliverablesRes,
    vendorIosRes,
    publicationsRes,
  ] = await Promise.all([
    supabase
      .from("campaign_influencers")
      .select(
        `id, campaign_header_id,
        campaign:${REL.campaignInfluencers.campaignHeader}(id, document_number, name)`
      )
      .eq("influencer_id", influencerId)
      .limit(50),
    supabase
      .from("discovery_shortlist_items")
      .select(
        `id, shortlist_id,
        shortlist:discovery_shortlists(id, serial_number, name)`
      )
      .eq("influencer_id", influencerId)
      .order("added_at", { ascending: false })
      .limit(50),
    supabase
      .from("quotation_items")
      .select(
        `id, quotation_id,
        quotation:quotations(id, serial_number, name)`
      )
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("deliverables")
      .select("id, document_number, title, campaign_id")
      .eq("influencer_id", influencerId)
      .limit(50),
    supabase
      .from("vendor_ios")
      .select("id, document_number, campaign_header_id")
      .eq("influencer_id", influencerId)
      .limit(50),
    supabase
      .from("campaign_publications")
      .select("id, content_url, campaign_header_id")
      .eq("influencer_id", influencerId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  for (const error of [
    assignmentsRes.error,
    shortlistItemsRes.error,
    quotationItemsRes.error,
    deliverablesRes.error,
    vendorIosRes.error,
    publicationsRes.error,
  ]) {
    if (error) throw new Error(error.message);
  }

  for (const row of assignmentsRes.data ?? []) {
    const r = row as {
      id: string;
      campaign_header_id: string;
      campaign:
        | { id: string; document_number: string | null; name: string | null }
        | Array<{ id: string; document_number: string | null; name: string | null }>
        | null;
    };
    const campaign = Array.isArray(r.campaign) ? r.campaign[0] : r.campaign;
    links.push({
      kind: "campaign",
      id: campaign?.id ?? r.campaign_header_id,
      reference: campaign?.document_number?.trim() || campaign?.id || r.id,
      name: campaign?.name ?? null,
    });
  }

  for (const row of shortlistItemsRes.data ?? []) {
    const r = row as {
      id: string;
      shortlist_id: string;
      shortlist:
        | { id: string; serial_number: string | null; name: string | null }
        | Array<{ id: string; serial_number: string | null; name: string | null }>
        | null;
    };
    const shortlist = Array.isArray(r.shortlist) ? r.shortlist[0] : r.shortlist;
    links.push({
      kind: "shortlist",
      id: shortlist?.id ?? r.shortlist_id,
      reference: shortlist?.serial_number?.trim() || shortlist?.id || r.id,
      name: shortlist?.name ?? null,
    });
  }

  for (const row of quotationItemsRes.data ?? []) {
    const r = row as {
      id: string;
      quotation_id: string;
      quotation:
        | { id: string; serial_number: string | null; name: string | null }
        | Array<{ id: string; serial_number: string | null; name: string | null }>
        | null;
    };
    const quotation = Array.isArray(r.quotation) ? r.quotation[0] : r.quotation;
    links.push({
      kind: "quotation",
      id: quotation?.id ?? r.quotation_id,
      reference: quotation?.serial_number?.trim() || quotation?.id || r.id,
      name: quotation?.name ?? null,
    });
  }

  for (const row of deliverablesRes.data ?? []) {
    const r = row as { id: string; document_number: string | null; title: string | null };
    links.push({
      kind: "deliverable",
      id: r.id,
      reference: r.document_number?.trim() || r.id,
      name: r.title?.trim() || null,
    });
  }

  for (const row of vendorIosRes.data ?? []) {
    const r = row as { id: string; document_number: string | null; campaign_header_id: string | null };
    links.push({
      kind: "vendor_io",
      id: r.id,
      reference: r.document_number?.trim() || r.id,
      name: null,
    });
  }

  for (const row of publicationsRes.data ?? []) {
    const r = row as {
      id: string;
      content_url: string | null;
      campaign_header_id: string | null;
    };
    links.push({
      kind: "publication",
      id: r.id,
      reference: r.id,
      name: r.content_url?.trim() || null,
    });
  }

  const campaignIds = [
    ...new Set(
      links.filter((link) => link.kind === "campaign").map((link) => link.id)
    ),
  ];

  if (campaignIds.length > 0) {
    const { data: invoiceRows, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, document_number, campaign_header_id")
      .in("campaign_header_id", campaignIds)
      .limit(50);

    if (invoiceError) throw new Error(invoiceError.message);

    for (const row of invoiceRows ?? []) {
      const r = row as { id: string; document_number: string | null; campaign_header_id: string | null };
      links.push({
        kind: "invoice",
        id: r.id,
        reference: r.document_number?.trim() || r.id,
        name: null,
      });
    }
  }

  const unique = new Map<string, CreatorDeleteLinkRef>();
  for (const link of links) {
    unique.set(`${link.kind}:${link.id}`, link);
  }
  const deduped = [...unique.values()];

  return {
    canDelete: deduped.length === 0,
    links: deduped,
    message: blockerMessage(deduped),
  };
}

export const CREATOR_DELETE_LINK_LABELS: Record<CreatorDeleteLinkRef["kind"], string> = {
  campaign: "Campaign",
  shortlist: "Shortlist",
  quotation: "Quotation",
  deliverable: "Deliverable",
  vendor_io: "Vendor IO",
  publication: "Publication",
  invoice: "Invoice",
};
