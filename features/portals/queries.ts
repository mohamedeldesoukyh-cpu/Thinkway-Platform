import { safeOperationalQuery } from "@/lib/platform/safe-query";
import { devLog } from "@/lib/platform/logger";
import { requireClientScope, requireCreatorScope } from "@/features/portals/scope";
import type {
  ClientApprovalRow,
  ClientCampaignRow,
  ClientDashboardSummary,
  ClientInvoiceRow,
  ClientReportRow,
  CreatorCampaignDetail,
  CreatorCampaignRow,
  CreatorDashboardSummary,
  CreatorDeliverableRow,
  PortalUploadRow,
  CreatorPaymentRow,
  CreatorPublicationRow,
  CreatorVendorIoRow,
  PortalApprovalStatus,
  PortalNotificationRow,
  PortalPaymentStatus,
} from "@/features/portals/types";

function mapPortalPaymentStatus(vendorPaymentStatus: string, paidAmount: number, invoicedAmount: number): PortalPaymentStatus {
  if (paidAmount > 0 && paidAmount >= invoicedAmount && invoicedAmount > 0) {
    return "Paid";
  }
  if (paidAmount > 0 && paidAmount < invoicedAmount) {
    return "Partially Paid";
  }
  if (vendorPaymentStatus === "invoiced" || invoicedAmount > 0) {
    return "Invoiced";
  }
  return "Pending";
}

function mapClientInvoiceStatus(status: string, amountPaid: number, total: number): ClientInvoiceRow["status"] {
  if (amountPaid >= total && total > 0) return "Paid";
  if (amountPaid > 0 && amountPaid < total) return "Partially Paid";
  if (status === "draft") return "Draft";
  return "Issued";
}

function mapApprovalStatus(status: string): PortalApprovalStatus {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

export function debugCreatorPortal(message: string, detail?: unknown) {
  devLog("[creator-portal]", message, detail);
}

export function debugClientPortal(message: string, detail?: unknown) {
  devLog("[client-portal]", message, detail);
}

export async function getCreatorCampaigns(): Promise<CreatorCampaignRow[]> {
  const result = await safeOperationalQuery(
    "creator-portal:getCampaigns",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("campaign_influencers")
        .select(
          `
          id, campaign_header_id, status, agreed_fee, currency, vendor_payment_status,
          confirmed_at,
          campaign:campaign_headers!campaign_influencers_campaign_header_id_fkey(
            id, document_number, name, start_date, end_date
          ),
          io:vendor_ios!vendor_ios_assignment_id_fkey(status),
          deliverables:deliverables!deliverables_campaign_influencer_id_fkey(id, status)
        `
        )
        .eq("influencer_id", scope.influencerId)
        .order("confirmed_at", { ascending: false, nullsFirst: false });

      if (error) throw new Error(error.message);

      const campaignHeaderIds = ((data ?? []) as { campaign_header_id: string }[])
        .map((row) => row.campaign_header_id)
        .filter(Boolean);

      let publicationsByCampaign = new Map<
        string,
        { total: number; latestStatus: string | null; latestDate: string | null }
      >();

      if (campaignHeaderIds.length > 0) {
        const { data: publicationRows, error: publicationError } = await supabase
          .from("campaign_publications")
          .select("campaign_header_id, status, publication_date")
          .eq("influencer_id", scope.influencerId)
          .in("campaign_header_id", campaignHeaderIds)
          .order("publication_date", { ascending: false, nullsFirst: false });

        if (publicationError) throw new Error(publicationError.message);

        for (const row of (publicationRows ?? []) as {
          campaign_header_id: string;
          status: string;
          publication_date: string | null;
        }[]) {
          const existing = publicationsByCampaign.get(row.campaign_header_id) ?? {
            total: 0,
            latestStatus: null,
            latestDate: null,
          };
          existing.total += 1;
          if (!existing.latestDate || (row.publication_date ?? "") > existing.latestDate) {
            existing.latestDate = row.publication_date;
            existing.latestStatus = row.status;
          }
          publicationsByCampaign.set(row.campaign_header_id, existing);
        }
      }

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          campaign_header_id: string;
          status: string;
          agreed_fee: number;
          currency: string;
          vendor_payment_status: string;
          campaign: {
            id: string;
            document_number: string;
            name: string;
            start_date: string | null;
            end_date: string | null;
          } | null;
          io: { status: string }[] | null;
          deliverables: { id: string; status: string }[] | null;
        };

        const deliverables = typed.deliverables ?? [];
        const publicationSummary = publicationsByCampaign.get(typed.campaign_header_id) ?? {
          total: 0,
          latestStatus: null,
          latestDate: null,
        };

        return {
          campaign_header_id: typed.campaign_header_id,
          campaign_document_number: typed.campaign?.document_number ?? "—",
          campaign_name: typed.campaign?.name ?? "—",
          assignment_id: typed.id,
          assignment_status: typed.status,
          agreed_amount: Number(typed.agreed_fee ?? 0),
          currency_code: typed.currency ?? "USD",
          vendor_payment_status: typed.vendor_payment_status ?? "pending",
          start_date: typed.campaign?.start_date ?? null,
          end_date: typed.campaign?.end_date ?? null,
          vendor_io_status: typed.io?.[0]?.status ?? null,
          deliverable_total: deliverables.length,
          pending_deliverables: deliverables.filter((d) =>
            ["pending", "in_progress", "revision_requested"].includes(d.status)
          ).length,
          publication_total: publicationSummary.total,
          recent_publication_status: publicationSummary.latestStatus,
        } satisfies CreatorCampaignRow;
      });
    },
    []
  );

  return result.data;
}

export async function getCreatorCampaignDetail(
  campaignHeaderId: string
): Promise<CreatorCampaignDetail | null> {
  const result = await safeOperationalQuery(
    "creator-portal:getCampaignDetail",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("campaign_influencers")
        .select(
          `
          id, status, agreed_fee, currency,
          campaign:campaign_headers!campaign_influencers_campaign_header_id_fkey(
            id, document_number, name, status, brief, start_date, end_date
          ),
          io:vendor_ios!vendor_ios_assignment_id_fkey(id, status),
          deliverables:deliverables!deliverables_campaign_influencer_id_fkey(
            id, document_number, campaign_id, title, deliverable_type, platform, status,
            due_date, submitted_at, approved_at, published_at, content_url
          )
        `
        )
        .eq("influencer_id", scope.influencerId)
        .eq("campaign_header_id", campaignHeaderId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      const typed = data as {
        id: string;
        status: string;
        agreed_fee: number;
        currency: string;
        campaign: {
          id: string;
          document_number: string;
          name: string;
          status: string;
          brief: string | null;
          start_date: string | null;
          end_date: string | null;
        } | null;
        io: { id: string; status: string }[] | null;
        deliverables: CreatorDeliverableRow[] | null;
      };

      const deliverables = ((typed.deliverables ?? []) as unknown[]).map((row) => {
        const d = row as CreatorDeliverableRow & { campaign_id: string };
        return {
          ...d,
          campaign_header_id: d.campaign_id,
          campaign_name: typed.campaign?.name ?? "—",
        } satisfies CreatorDeliverableRow;
      });

      return {
        campaign_header_id: campaignHeaderId,
        campaign_document_number: typed.campaign?.document_number ?? "—",
        campaign_name: typed.campaign?.name ?? "—",
        campaign_status: typed.campaign?.status ?? "—",
        brief: typed.campaign?.brief ?? null,
        start_date: typed.campaign?.start_date ?? null,
        end_date: typed.campaign?.end_date ?? null,
        assignment_id: typed.id,
        assignment_status: typed.status,
        agreed_amount: Number(typed.agreed_fee ?? 0),
        currency_code: typed.currency ?? "USD",
        vendor_io_status: typed.io?.[0]?.status ?? null,
        vendor_io_id: typed.io?.[0]?.id ?? null,
        deliverables,
      } satisfies CreatorCampaignDetail;
    },
    null
  );

  return result.data;
}

export async function getPortalUploadsForDeliverable(
  deliverableId: string
): Promise<PortalUploadRow[]> {
  const result = await safeOperationalQuery(
    "creator-portal:getDeliverableUploads",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("portal_uploads")
        .select("id, file_name, external_link, storage_path, created_at")
        .eq("portal_type", "creator")
        .eq("entity_type", "deliverable")
        .eq("entity_id", deliverableId)
        .eq("influencer_id", scope.influencerId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []) as PortalUploadRow[];
    },
    []
  );

  return result.data;
}

export async function getCreatorUnreadNotificationCount(): Promise<number> {
  const result = await safeOperationalQuery(
    "creator-portal:unreadCount",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { count, error } = await supabase
        .from("portal_notifications")
        .select("id", { count: "exact", head: true })
        .eq("audience_type", "creator")
        .eq("influencer_id", scope.influencerId)
        .eq("is_read", false);

      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    0
  );

  return result.data;
}

export async function getClientUnreadNotificationCount(): Promise<number> {
  const result = await safeOperationalQuery(
    "client-portal:unreadCount",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const { count, error } = await supabase
        .from("portal_notifications")
        .select("id", { count: "exact", head: true })
        .eq("audience_type", "client")
        .in("client_id", scope.clientIds)
        .eq("is_read", false);

      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    0
  );

  return result.data;
}

export async function getCreatorDeliverables(): Promise<CreatorDeliverableRow[]> {
  const result = await safeOperationalQuery(
    "creator-portal:getDeliverables",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("deliverables")
        .select(
          `
          id, document_number, campaign_id, title, deliverable_type, platform, status,
          due_date, submitted_at, approved_at, published_at, content_url,
          campaign:campaign_headers!deliverables_campaign_id_fkey(id, name)
        `
        )
        .eq("influencer_id", scope.influencerId)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          document_number: string;
          campaign_id: string;
          title: string;
          deliverable_type: string;
          platform: string | null;
          status: string;
          due_date: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          published_at: string | null;
          content_url: string | null;
          campaign: { id: string; name: string } | null;
        };

        return {
          id: typed.id,
          document_number: typed.document_number,
          campaign_header_id: typed.campaign_id,
          campaign_name: typed.campaign?.name ?? "—",
          title: typed.title,
          deliverable_type: typed.deliverable_type,
          platform: typed.platform,
          status: typed.status,
          due_date: typed.due_date,
          submitted_at: typed.submitted_at,
          approved_at: typed.approved_at,
          published_at: typed.published_at,
          content_url: typed.content_url,
        } satisfies CreatorDeliverableRow;
      });
    },
    []
  );

  return result.data;
}

export async function getCreatorPublications(): Promise<CreatorPublicationRow[]> {
  const result = await safeOperationalQuery(
    "creator-portal:getPublications",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("campaign_publications")
        .select(
          `
          id, campaign_header_id, platform, publication_type, content_url, publication_date, status, notes,
          campaign:campaign_headers!campaign_publications_campaign_header_id_fkey(name)
        `
        )
        .eq("influencer_id", scope.influencerId)
        .order("publication_date", { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          campaign_header_id: string;
          platform: string;
          publication_type: string;
          content_url: string | null;
          publication_date: string | null;
          status: string;
          notes: string | null;
          campaign: { name: string } | null;
        };

        return {
          id: typed.id,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? "—",
          platform: typed.platform,
          publication_type: typed.publication_type,
          content_url: typed.content_url,
          publication_date: typed.publication_date,
          status: typed.status,
          notes: typed.notes,
        } satisfies CreatorPublicationRow;
      });
    },
    []
  );

  return result.data;
}

export async function getCreatorVendorIos(): Promise<CreatorVendorIoRow[]> {
  const result = await safeOperationalQuery(
    "creator-portal:getVendorIos",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("vendor_ios")
        .select(
          `
          id, assignment_id, campaign_header_id, amount, currency_code, status, sent_at, approved_at, rejection_reason,
          campaign:campaign_headers!vendor_ios_campaign_header_id_fkey(name)
        `
        )
        .eq("influencer_id", scope.influencerId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          assignment_id: string;
          campaign_header_id: string;
          amount: number;
          currency_code: string;
          status: string;
          sent_at: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          campaign: { name: string } | null;
        };

        return {
          id: typed.id,
          assignment_id: typed.assignment_id,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? "—",
          amount: Number(typed.amount ?? 0),
          currency_code: typed.currency_code ?? "USD",
          status: typed.status,
          sent_at: typed.sent_at,
          approved_at: typed.approved_at,
          rejection_reason: typed.rejection_reason,
        } satisfies CreatorVendorIoRow;
      });
    },
    []
  );

  return result.data;
}

export async function getCreatorPayments(): Promise<CreatorPaymentRow[]> {
  const result = await safeOperationalQuery(
    "creator-portal:getPayments",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("campaign_influencers")
        .select(
          `
          id, campaign_header_id, agreed_fee, currency, vendor_payment_status,
          campaign:campaign_headers!campaign_influencers_campaign_header_id_fkey(name),
          line:campaign_lines!campaign_influencers_campaign_line_id_fkey(
            id, cost, billing_status
          )
        `
        )
        .eq("influencer_id", scope.influencerId)
        .order("updated_at", { ascending: false });

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          campaign_header_id: string;
          agreed_fee: number;
          currency: string;
          vendor_payment_status: string;
          campaign: { name: string } | null;
          line: { id: string; cost: number; billing_status: string } | null;
        };

        const agreed = Number(typed.agreed_fee ?? 0);
        const invoiced =
          typed.vendor_payment_status === "invoiced" ||
          typed.vendor_payment_status === "partially_paid" ||
          typed.vendor_payment_status === "paid"
            ? agreed
            : 0;
        const paid = typed.vendor_payment_status === "paid" ? agreed : 0;
        const pending = Math.max(0, agreed - paid);
        const paymentStatus = mapPortalPaymentStatus(
          typed.vendor_payment_status ?? "pending",
          paid,
          invoiced
        );

        return {
          assignment_id: typed.id,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? "—",
          agreed_amount: agreed,
          invoiced_amount: invoiced,
          paid_amount: paid,
          pending_amount: pending,
          payment_status: paymentStatus,
          vendor_payment_status: typed.vendor_payment_status ?? "pending",
          currency_code: typed.currency ?? "USD",
        } satisfies CreatorPaymentRow;
      });
    },
    []
  );

  return result.data;
}

export async function getCreatorNotifications(): Promise<PortalNotificationRow[]> {
  const result = await safeOperationalQuery(
    "creator-portal:getNotifications",
    async () => {
      const { supabase, scope } = await requireCreatorScope("creator_portal.read");
      const { data, error } = await supabase
        .from("portal_notifications")
        .select("id, title, message, event_type, created_at, is_read, campaign_header_id")
        .eq("audience_type", "creator")
        .eq("influencer_id", scope.influencerId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);
      return (data ?? []) as PortalNotificationRow[];
    },
    []
  );

  return result.data;
}

export async function getCreatorDashboardSummary(): Promise<CreatorDashboardSummary> {
  const [campaigns, payments, publications, notifications, vendorIos, deliverables] =
    await Promise.all([
      getCreatorCampaigns(),
      getCreatorPayments(),
      getCreatorPublications(),
      getCreatorNotifications(),
      getCreatorVendorIos(),
      getCreatorDeliverables(),
    ]);

  return {
    active_campaigns: campaigns.filter((c) => c.assignment_status === "confirmed").length,
    pending_deliverables: deliverables.filter((d) =>
      ["pending", "in_progress", "revision_requested"].includes(d.status)
    ).length,
    pending_vendor_io_approvals: vendorIos.filter((io) => io.status === "sent").length,
    pending_payments: payments.filter((p) => p.payment_status !== "Paid").length,
    recent_publications: publications.slice(0, 6),
    notifications: notifications.slice(0, 8),
  };
}

export async function getClientCampaigns(): Promise<ClientCampaignRow[]> {
  const result = await safeOperationalQuery(
    "client-portal:getCampaigns",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const { data, error } = await supabase
        .from("campaign_headers")
        .select(
          `
          id, document_number, name, status, start_date, end_date,
          client_io:client_ios(status),
          lines:campaign_lines(id),
          publications:campaign_publications(id, status)
        `
        )
        .in("client_id", scope.clientIds)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          document_number: string;
          name: string;
          status: string;
          start_date: string | null;
          end_date: string | null;
          client_io: { status: string }[] | null;
          lines: { id: string }[] | null;
          publications: { id: string; status: string }[] | null;
        };

        const publications = typed.publications ?? [];
        const latestPublication = publications[0] ?? null;

        return {
          campaign_header_id: typed.id,
          campaign_document_number: typed.document_number,
          campaign_name: typed.name,
          status: typed.status,
          start_date: typed.start_date,
          end_date: typed.end_date,
          client_io_status: typed.client_io?.[0]?.status ?? null,
          deliverable_total: (typed.lines ?? []).length,
          pending_approvals: publications.filter((p) => p.status === "pending").length,
          publication_total: publications.length,
          latest_publication_status: latestPublication?.status ?? null,
        } satisfies ClientCampaignRow;
      });
    },
    []
  );

  return result.data;
}

export async function getClientPublications(): Promise<CreatorPublicationRow[]> {
  const result = await safeOperationalQuery(
    "client-portal:getPublications",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const { data: headers, error: headersError } = await supabase
        .from("campaign_headers")
        .select("id")
        .in("client_id", scope.clientIds)
        .limit(500);

      if (headersError) throw new Error(headersError.message);
      const campaignHeaderIds = ((headers ?? []) as { id: string }[])
        .map((row) => row.id)
        .filter(Boolean);
      if (campaignHeaderIds.length === 0) return [];

      const { data, error } = await supabase
        .from("campaign_publications")
        .select(
          `
          id, campaign_header_id, platform, publication_type, content_url, publication_date, status, notes,
          campaign:campaign_headers!campaign_publications_campaign_header_id_fkey(name)
        `
        )
        .in("campaign_header_id", campaignHeaderIds)
        .order("publication_date", { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          campaign_header_id: string;
          platform: string;
          publication_type: string;
          content_url: string | null;
          publication_date: string | null;
          status: string;
          notes: string | null;
          campaign: { name: string } | null;
        };
        return {
          id: typed.id,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? "—",
          platform: typed.platform,
          publication_type: typed.publication_type,
          content_url: typed.content_url,
          publication_date: typed.publication_date,
          status: typed.status,
          notes: typed.notes,
        } satisfies CreatorPublicationRow;
      });
    },
    []
  );

  return result.data;
}

export async function getClientApprovals(): Promise<ClientApprovalRow[]> {
  const result = await safeOperationalQuery(
    "client-portal:getApprovals",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const [publicationsResult, deliverablesResult, iosResult] = await Promise.all([
        supabase
          .from("campaign_publications")
          .select(
            `
            id, campaign_header_id, status, updated_at,
            campaign:campaign_headers!campaign_publications_campaign_header_id_fkey(name, client_id)
          `
          )
          .order("updated_at", { ascending: false })
          .limit(120),
        supabase
          .from("deliverables")
          .select(
            `
            id, campaign_id, title, status, approved_at,
            campaign:campaign_headers!deliverables_campaign_id_fkey(name, client_id)
          `
          )
          .order("updated_at", { ascending: false })
          .limit(120),
        supabase
          .from("client_ios")
          .select(
            `
            id, campaign_header_id, status, approved_by_name, approved_at,
            campaign:campaign_headers!client_ios_campaign_header_id_fkey(name, client_id)
          `
          )
          .order("updated_at", { ascending: false })
          .limit(120),
      ]);

      if (publicationsResult.error) throw new Error(publicationsResult.error.message);
      if (deliverablesResult.error) throw new Error(deliverablesResult.error.message);
      if (iosResult.error) throw new Error(iosResult.error.message);

      const rows: ClientApprovalRow[] = [];

      for (const row of (publicationsResult.data ?? []) as any[]) {
        const campaignClientId = row?.campaign?.client_id as string | undefined;
        if (!campaignClientId || !scope.clientIds.includes(campaignClientId)) continue;
        rows.push({
          id: `publication:${row.id}`,
          entity_type: "publication",
          entity_id: row.id as string,
          campaign_header_id: row.campaign_header_id as string,
          campaign_name: (row.campaign?.name as string) ?? "—",
          title: "Publication approval",
          status: mapApprovalStatus(String(row.status ?? "pending")),
          approved_by_name: null,
          approved_at: null,
        });
      }

      for (const row of (deliverablesResult.data ?? []) as any[]) {
        const campaignClientId = row?.campaign?.client_id as string | undefined;
        if (!campaignClientId || !scope.clientIds.includes(campaignClientId)) continue;
        rows.push({
          id: `deliverable:${row.id}`,
          entity_type: "deliverable",
          entity_id: row.id as string,
          campaign_header_id: row.campaign_id as string,
          campaign_name: (row.campaign?.name as string) ?? "—",
          title: (row.title as string) ?? "Deliverable approval",
          status: mapApprovalStatus(String(row.status ?? "pending")),
          approved_by_name: null,
          approved_at: (row.approved_at as string | null) ?? null,
        });
      }

      for (const row of (iosResult.data ?? []) as any[]) {
        const campaignClientId = row?.campaign?.client_id as string | undefined;
        if (!campaignClientId || !scope.clientIds.includes(campaignClientId)) continue;
        rows.push({
          id: `client_io:${row.id}`,
          entity_type: "client_io",
          entity_id: row.id as string,
          campaign_header_id: row.campaign_header_id as string,
          campaign_name: (row.campaign?.name as string) ?? "—",
          title: "Client IO approval",
          status: mapApprovalStatus(String(row.status ?? "pending")),
          approved_by_name: (row.approved_by_name as string | null) ?? null,
          approved_at: (row.approved_at as string | null) ?? null,
        });
      }

      return rows
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, 200);
    },
    []
  );

  return result.data;
}

export async function getClientInvoices(): Promise<ClientInvoiceRow[]> {
  const result = await safeOperationalQuery(
    "client-portal:getInvoices",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const { data, error } = await supabase
        .from("invoices")
        .select(
          `
          id, document_number, campaign_header_id, issue_date, due_date, total, amount_paid, status, currency,
          campaign:campaign_headers!invoices_campaign_header_id_fkey(name)
        `
        )
        .in("client_id", scope.clientIds)
        .order("issue_date", { ascending: false });

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          document_number: string;
          campaign_header_id: string | null;
          issue_date: string;
          due_date: string | null;
          total: number;
          amount_paid: number;
          status: string;
          currency: string;
          campaign: { name: string } | null;
        };
        const total = Number(typed.total ?? 0);
        const amountPaid = Number(typed.amount_paid ?? 0);
        return {
          id: typed.id,
          document_number: typed.document_number,
          campaign_header_id: typed.campaign_header_id,
          campaign_name: typed.campaign?.name ?? null,
          issue_date: typed.issue_date,
          due_date: typed.due_date,
          amount_total: total,
          amount_paid: amountPaid,
          amount_pending: Math.max(0, total - amountPaid),
          status: mapClientInvoiceStatus(typed.status, amountPaid, total),
          currency: typed.currency ?? "USD",
        } satisfies ClientInvoiceRow;
      });
    },
    []
  );

  return result.data;
}

export async function getClientReports(): Promise<ClientReportRow[]> {
  const result = await safeOperationalQuery(
    "client-portal:getReports",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const [campaignsResult, deliverablesResult, publicationsResult] = await Promise.all([
        supabase
          .from("campaign_headers")
          .select("id, name, status, start_date, end_date")
          .in("client_id", scope.clientIds)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("deliverables")
          .select("id, campaign_id, status")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("campaign_publications")
          .select("id, campaign_header_id, status")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (campaignsResult.error) throw new Error(campaignsResult.error.message);
      if (deliverablesResult.error) throw new Error(deliverablesResult.error.message);
      if (publicationsResult.error) throw new Error(publicationsResult.error.message);

      const deliverablesByCampaign = new Map<string, { total: number; approved: number }>();
      for (const row of (deliverablesResult.data ?? []) as { campaign_id: string; status: string }[]) {
        const current = deliverablesByCampaign.get(row.campaign_id) ?? { total: 0, approved: 0 };
        current.total += 1;
        if (row.status === "approved" || row.status === "published") current.approved += 1;
        deliverablesByCampaign.set(row.campaign_id, current);
      }

      const publicationsByCampaign = new Map<string, { total: number; approved: number }>();
      for (const row of (publicationsResult.data ?? []) as { campaign_header_id: string; status: string }[]) {
        const current = publicationsByCampaign.get(row.campaign_header_id) ?? { total: 0, approved: 0 };
        current.total += 1;
        if (row.status === "approved") current.approved += 1;
        publicationsByCampaign.set(row.campaign_header_id, current);
      }

      return ((campaignsResult.data ?? []) as unknown[]).map((row) => {
        const typed = row as {
          id: string;
          name: string;
          status: string;
          start_date: string | null;
          end_date: string | null;
        };
        const d = deliverablesByCampaign.get(typed.id) ?? { total: 0, approved: 0 };
        const p = publicationsByCampaign.get(typed.id) ?? { total: 0, approved: 0 };
        return {
          campaign_header_id: typed.id,
          campaign_name: typed.name,
          campaign_status: typed.status,
          start_date: typed.start_date,
          end_date: typed.end_date,
          total_publications: p.total,
          approved_publications: p.approved,
          total_deliverables: d.total,
          approved_deliverables: d.approved,
        } satisfies ClientReportRow;
      });
    },
    []
  );

  return result.data;
}

export async function getClientNotifications(): Promise<PortalNotificationRow[]> {
  const result = await safeOperationalQuery(
    "client-portal:getNotifications",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const { data, error } = await supabase
        .from("portal_notifications")
        .select("id, title, message, event_type, created_at, is_read, campaign_header_id")
        .eq("audience_type", "client")
        .in("client_id", scope.clientIds)
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw new Error(error.message);
      return (data ?? []) as PortalNotificationRow[];
    },
    []
  );
  return result.data;
}

export async function getClientIosList() {
  const result = await safeOperationalQuery(
    "client-portal:getClientIos",
    async () => {
      const { supabase, scope } = await requireClientScope("client_portal.read");
      const { data, error } = await supabase
        .from("client_ios")
        .select(
          `
          id, campaign_header_id, client_id, status, sent_at, approved_at, approved_by_name, terms_text, billing_terms,
          campaign:campaign_headers!client_ios_campaign_header_id_fkey(name)
        `
        )
        .in("client_id", scope.clientIds)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown[];
    },
    []
  );
  return result.data;
}

export async function getClientDashboardSummary(): Promise<ClientDashboardSummary> {
  const [campaigns, approvals, invoices, publications, notifications, clientIos] = await Promise.all([
    getClientCampaigns(),
    getClientApprovals(),
    getClientInvoices(),
    getClientPublications(),
    getClientNotifications(),
    getClientIosList(),
  ]);

  return {
    active_campaigns: campaigns.filter((c) => c.status === "active").length,
    pending_approvals: approvals.filter((a) => a.status === "Pending").length,
    pending_client_io: (clientIos as any[]).filter((io) => io.status === "sent").length,
    open_invoices: invoices.filter((i) => i.status !== "Paid").length,
    recent_publications: publications.slice(0, 6),
    notifications: notifications.slice(0, 8),
  };
}
