import type { SupabaseClient } from "@supabase/supabase-js";

import { formatPaymentMethodLabel } from "@/features/vendors/utils";
import { resolveVendorIoPaymentSchedule } from "@/lib/io/vendor-io-payment-terms";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import type { VendorIoDocumentData, VendorIoDeliverableRow } from "@/lib/io/vendor-io-document-types";
import { sumVendorIoLineAmounts } from "@/lib/io/vendor-io-line-amount";

function formatAddress(parts: Array<string | null | undefined>): string | null {
  const joined = parts.filter(Boolean).join(", ");
  return joined || null;
}

function jsonString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadVendorIoDocumentData(
  supabase: SupabaseClient,
  vendorIoId: string
): Promise<VendorIoDocumentData> {
  const { data: vendorIo, error: vioError } = await supabase
    .from("vendor_ios")
    .select(
      "id, document_number, revision_number, amount, currency_code, status, usage_rights, special_payment_terms, created_at, influencer_id, campaign_header_id"
    )
    .eq("id", vendorIoId)
    .single();

  if (vioError || !vendorIo) {
    throw new Error(vioError?.message ?? "Vendor IO not found");
  }

  const typedVio = vendorIo as {
    id: string;
    document_number: string | null;
    revision_number: number;
    amount: number;
    currency_code: string;
    status: string;
    usage_rights: string | null;
    special_payment_terms: string | null;
    created_at: string;
    influencer_id: string;
    campaign_header_id: string;
  };

  const [{ data: influencer }, { data: campaign }, { data: lineLinks }] = await Promise.all([
    supabase
      .from("influencers")
      .select(
        "id, display_name, legal_name, email, phone, nationality, country_code, languages, categories, payment_details, payment_terms, metadata, city"
      )
      .eq("id", typedVio.influencer_id)
      .single(),
    supabase
      .from("campaign_headers")
      .select(
        "id, document_number, name, start_date, end_date, client_id, brand_id, clients:client_id(name, legal_name, country), brands:brand_id(name)"
      )
      .eq("id", typedVio.campaign_header_id)
      .single(),
    supabase
      .from("vendor_io_lines")
      .select("campaign_line_id, campaign_lines:campaign_line_id(id, name, document_number, metadata, cost_before_vat, cost, revenue_before_vat, revenue, usage_rights_amount)")
      .eq("vendor_io_id", vendorIoId),
  ]);

  if (!influencer || !campaign) {
    throw new Error("Missing influencer or campaign data for Vendor IO");
  }

  const typedInfluencer = influencer as {
    id: string;
    display_name: string;
    legal_name: string | null;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    country_code: string | null;
    languages: string[];
    categories: string[];
    payment_details: Record<string, unknown>;
    payment_terms: string | null;
    metadata: Record<string, unknown>;
    city: string | null;
  };

  const typedCampaignRaw = campaign as {
    id: string;
    document_number: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    clients:
      | { name: string; legal_name: string | null; country: string | null }
      | Array<{ name: string; legal_name: string | null; country: string | null }>
      | null;
    brands: { name: string } | Array<{ name: string }> | null;
  };

  const typedCampaign = {
    ...typedCampaignRaw,
    clients: unwrapRelation(typedCampaignRaw.clients),
    brands: unwrapRelation(typedCampaignRaw.brands),
  };

  const lineIds = (lineLinks ?? []).map(
    (row) => (row as { campaign_line_id: string }).campaign_line_id
  );

  const { data: deliverables } = lineIds.length
    ? await supabase
        .from("assignment_deliverables")
        .select(
          "platform, deliverable_type, quantity, unit_cost, total_cost, cost_before_vat, cost_vat_amount, cost_vat_percent, live_date, campaign_line_id"
        )
        .in("campaign_line_id", lineIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select("platform, handle, follower_count, engagement_rate, is_primary, profile_url")
    .eq("influencer_id", typedVio.influencer_id);

  const typedAccounts = (accounts ?? []) as Array<{
    platform: string;
    handle: string;
    follower_count: number;
    engagement_rate: number | null;
    is_primary: boolean;
    profile_url: string | null;
  }>;

  const primaryAccount =
    typedAccounts.find((a) => a.is_primary) ?? typedAccounts[0] ?? null;

  const handleByPlatform = new Map(
    typedAccounts.map((a) => [a.platform.toLowerCase(), `@${a.handle.replace(/^@/, "")}`])
  );

  const deliverableRows: VendorIoDeliverableRow[] = (deliverables ?? []).map((row) => {
    const typed = row as {
      platform: string;
      deliverable_type: string;
      quantity: number;
      unit_cost: number;
      total_cost: number;
      live_date: string | null;
    };
    return {
      platform: typed.platform,
      deliverableType: typed.deliverable_type,
      quantity: typed.quantity,
      unitCost: Number(typed.unit_cost ?? 0),
      totalCost: Number(typed.total_cost ?? 0),
      handle: handleByPlatform.get(typed.platform.toLowerCase()) ?? primaryAccount?.handle ?? "—",
      scheduledDates: typed.live_date
        ? new Date(`${typed.live_date}T00:00:00`).toLocaleDateString("en-GB")
        : "—",
    };
  });

  type LinkedCampaignLine = {
    id: string;
    name: string;
    document_number: string | null;
    metadata: Record<string, unknown> | null;
    cost_before_vat: number | null;
    cost: number | null;
    revenue_before_vat: number | null;
    revenue: number | null;
    usage_rights_amount?: number | null;
  };

  const linkedLines = (lineLinks ?? [])
    .map((row) => {
      const typed = row as {
        campaign_line_id: string;
        campaign_lines: LinkedCampaignLine | LinkedCampaignLine[] | null;
      };
      return unwrapRelation(typed.campaign_lines);
    })
    .filter((line): line is LinkedCampaignLine => line != null);

  const contentCreationFee = deliverableRows.reduce((sum, d) => sum + d.totalCost, 0);
  const lineSubtotal =
    contentCreationFee > 0
      ? contentCreationFee
      : sumVendorIoLineAmounts(
          linkedLines.map((line) => ({
            cost_before_vat: line!.cost_before_vat,
            cost: line!.cost,
            revenue_before_vat: line!.revenue_before_vat,
            revenue: line!.revenue,
          }))
        );

  const vatAmount = (deliverables ?? []).reduce(
    (sum, row) => sum + Number((row as { cost_vat_amount?: number }).cost_vat_amount ?? 0),
    0
  );
  const vatPercent =
    Number((deliverables?.[0] as { cost_vat_percent?: number } | undefined)?.cost_vat_percent) ||
    THINKWAY_AGENCY_DEFAULTS.defaultVatPercent;

  const linkedUsageRightsTotal = linkedLines.reduce(
    (sum, line) => sum + Number(line?.usage_rights_amount ?? 0),
    0
  );
  const usageRightsFee = linkedUsageRightsTotal;
  const totalDue = Number(typedVio.amount) || lineSubtotal + usageRightsFee + vatAmount;

  const platforms = [
    ...new Set([
      ...deliverableRows.map((d) => d.platform),
      ...typedAccounts.map((a) => a.platform),
    ]),
  ];

  const metadata = typedInfluencer.metadata ?? {};
  const rawPaymentDetails = typedInfluencer.payment_details ?? {};
  const beneficiaryName =
    (typeof rawPaymentDetails.beneficiary_name === "string" &&
      rawPaymentDetails.beneficiary_name.trim()) ||
    typedInfluencer.legal_name?.trim() ||
    typedInfluencer.display_name;

  const paymentDetails: Record<string, unknown> = {
    ...rawPaymentDetails,
    beneficiary_name: beneficiaryName,
    bank_name:
      typeof rawPaymentDetails.bank_name === "string" ? rawPaymentDetails.bank_name : null,
    bank_branch:
      typeof rawPaymentDetails.bank_branch === "string" ? rawPaymentDetails.bank_branch : null,
    account_number:
      typeof rawPaymentDetails.account_number === "string"
        ? rawPaymentDetails.account_number
        : null,
    swift: typeof rawPaymentDetails.swift === "string" ? rawPaymentDetails.swift : null,
    iban: typeof rawPaymentDetails.iban === "string" ? rawPaymentDetails.iban : null,
    payment_schedule: resolveVendorIoPaymentSchedule({
      specialPaymentTerms: typedVio.special_payment_terms,
      vendorPaymentTerms: typedInfluencer.payment_terms,
    }),
    method:
      typeof rawPaymentDetails.method === "string"
        ? formatPaymentMethodLabel(rawPaymentDetails.method)
        : formatPaymentMethodLabel("bank_transfer"),
  };

  return {
    vendorIoId: typedVio.id,
    documentNumber: typedVio.document_number ?? "VIO-PENDING",
    revisionNumber: typedVio.revision_number ?? 0,
    issuedAt: typedVio.created_at,
    issuedCountry: typedCampaign.clients?.country ?? THINKWAY_AGENCY_DEFAULTS.country,
    currencyCode: typedVio.currency_code,
    status: typedVio.status,
    amount: Number(typedVio.amount),
    usageRights: typedVio.usage_rights,
    influencer: {
      id: typedInfluencer.id,
      displayName: typedInfluencer.display_name,
      legalName: typedInfluencer.legal_name,
      email: typedInfluencer.email,
      phone: typedInfluencer.phone,
      nationality: typedInfluencer.nationality,
      address: formatAddress([
        jsonString(metadata.address),
        typedInfluencer.city,
        typedInfluencer.country_code,
      ]),
      nationalId:
        jsonString(metadata.national_id) ?? jsonString(metadata.trade_license) ?? null,
      categories: typedInfluencer.categories ?? [],
      countryCode: typedInfluencer.country_code,
      languages: typedInfluencer.languages ?? [],
      paymentDetails,
    },
    campaign: {
      id: typedCampaign.id,
      documentNumber: typedCampaign.document_number,
      name: typedCampaign.name,
      startDate: typedCampaign.start_date,
      endDate: typedCampaign.end_date,
      clientName: typedCampaign.clients?.legal_name ?? typedCampaign.clients?.name ?? "—",
      brandName: typedCampaign.brands?.name ?? "—",
      channels: platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", "),
      usagePeriod: typedVio.usage_rights,
    },
    influencerMetrics: {
      handle: primaryAccount
        ? `${typedInfluencer.display_name} / @${primaryAccount.handle.replace(/^@/, "")}`
        : typedInfluencer.display_name,
      platforms: platforms.join(", ") || "—",
      followerCount: primaryAccount
        ? Number(primaryAccount.follower_count).toLocaleString("en-US")
        : "—",
      niche: typedInfluencer.categories.join(", ") || "—",
      audience: [typedInfluencer.country_code, ...(typedInfluencer.languages ?? [])]
        .filter(Boolean)
        .join(" · ") || "—",
      engagementRate: primaryAccount?.engagement_rate != null
        ? `${Number(primaryAccount.engagement_rate).toFixed(2)}%`
        : "—",
    },
    deliverables: deliverableRows,
    pricing: {
      contentCreationFee: lineSubtotal,
      usageRightsFee,
      vatAmount,
      vatPercent,
      totalDue,
    },
    assignmentLineNames: linkedLines.map((line) => line!.name),
    assignmentDocumentNumbers: linkedLines
      .map((line) => line!.document_number)
      .filter((n): n is string => Boolean(n)),
  };
}
