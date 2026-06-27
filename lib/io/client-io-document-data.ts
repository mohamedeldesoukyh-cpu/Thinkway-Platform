import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeAgencyFeeAmount,
  resolveClientTaxableBase,
} from "@/lib/assignments/client-billing-commercial";
import {
  buildLineTitle,
  deliverableLabel,
  parseLineAssignment,
} from "@/lib/campaigns/line-assignment";
import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";
import {
  parseTermsText,
  resolveEffectiveTerms,
} from "@/lib/io/client-io-terms";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import type {
  ClientIoAssignmentPricing,
  ClientIoCampaignPricing,
  ClientIoDeliverableRow,
  ClientIoDocumentData,
} from "@/lib/io/client-io-document-types";
import { computeVatLine, roundMoney } from "@/lib/vat/calculations";

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function readAddressField(address: Record<string, unknown>, key: string): string | null {
  const value = address[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatClientAddress(input: {
  legalAddress: Record<string, unknown>;
  billingAddress: Record<string, unknown>;
  city: string | null;
  country: string | null;
}): string | null {
  const legal = input.legalAddress ?? {};
  const billing = input.billingAddress ?? {};

  const parts = [
    readAddressField(legal, "line1") ??
      readAddressField(billing, "line1") ??
      readAddressField(billing, "street"),
    readAddressField(legal, "line2") ??
      readAddressField(billing, "line2") ??
      readAddressField(billing, "street2"),
    readAddressField(legal, "city") ?? readAddressField(billing, "city") ?? input.city,
    readAddressField(legal, "country") ?? readAddressField(billing, "country") ?? input.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatPaymentTermsLabel(value: string | null): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  const map: Record<string, string> = {
    net_30: "Net 30 Days",
    net_15: "Net 15 Days",
    net_45: "Net 45 Days",
    net_60: "Net 60 Days",
    net_90: "Net 90 Days",
    due_on_receipt: "Due on Receipt",
    custom: "Custom Terms",
  };
  return map[normalized] ?? value.replace(/_/g, " ");
}

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    twitter: "X (Twitter)",
    x: "X (Twitter)",
  };
  const key = platform.toLowerCase();
  if (map[key]) return map[key];
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function formatObjectives(value: unknown): string | null {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : null))
      .filter(Boolean);
    return items.length > 0 ? items.join("; ") : null;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function resolveLineAgencyFeeAmount(input: {
  revenueBeforeVat: number;
  usageRightsAmount: number;
  agencyFeeAmount: number | null;
  agencyFeePercent: number;
}): number {
  if (input.agencyFeeAmount != null && input.agencyFeeAmount > 0) {
    return roundMoney(input.agencyFeeAmount);
  }
  return computeAgencyFeeAmount(
    input.revenueBeforeVat,
    input.usageRightsAmount,
    input.agencyFeePercent
  );
}

function buildCampaignPricing(
  assignmentLines: ClientIoAssignmentPricing[],
  currencyCode: string,
  vatPercent: number,
  vatExempt: boolean
): ClientIoCampaignPricing {
  const revenueTotal = roundMoney(
    assignmentLines.reduce((sum, line) => sum + line.revenueBeforeVat, 0)
  );
  const usageRightsTotal = roundMoney(
    assignmentLines.reduce((sum, line) => sum + line.usageRightsAmount, 0)
  );
  const agencyFeeTotal = roundMoney(
    assignmentLines.reduce((sum, line) => sum + line.agencyFeeAmount, 0)
  );

  const subtotal = resolveClientTaxableBase({
    revenueBeforeVat: revenueTotal,
    usageRightsAmount: usageRightsTotal,
    agencyFeeAmount: agencyFeeTotal,
  });

  const vat = computeVatLine({
    beforeVat: subtotal,
    vatPercent: vatExempt ? 0 : vatPercent,
    exempt: vatExempt,
  });

  return {
    currencyCode,
    vatPercent: vatExempt ? 0 : vatPercent,
    vatExempt,
    assignmentLines,
    revenueTotal,
    usageRightsTotal,
    agencyFeeTotal,
    subtotal,
    vatAmount: vat.vatAmount,
    total: vat.afterVat,
  };
}

export async function loadClientIoDocumentData(
  supabase: SupabaseClient,
  clientIoId: string,
  actorId?: string
): Promise<ClientIoDocumentData> {
  const { data: clientIo, error: cioError } = await supabase
    .from("client_ios")
    .select(
      "id, document_number, status, billing_terms, terms_text, created_at, campaign_header_id, client_id"
    )
    .eq("id", clientIoId)
    .single();

  if (cioError || !clientIo) {
    throw new Error(cioError?.message ?? "Client IO not found");
  }

  const typedCio = clientIo as {
    id: string;
    document_number: string | null;
    status: string;
    billing_terms: string | null;
    terms_text: string | null;
    created_at: string;
    campaign_header_id: string;
    client_id: string;
  };

  const profilePromise = actorId
    ? supabase
        .from("profiles")
        .select("full_name, email, job_title")
        .eq("id", actorId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [{ data: campaign }, { data: client }, { data: lines }, profileResult] =
    await Promise.all([
    supabase
      .from("campaign_headers")
      .select(
        "id, document_number, name, description, brief, start_date, end_date, objectives, currency_code, brands:brand_id(name), clients:client_id(name, legal_name, country)"
      )
      .eq("id", typedCio.campaign_header_id)
      .single(),
    supabase
      .from("clients")
      .select(
        "id, name, legal_name, trade_license_number, billing_email, billing_phone, legal_address, billing_address, city, country, payment_terms, metadata, client_io_terms_text"
      )
      .eq("id", typedCio.client_id)
      .single(),
    supabase
      .from("campaign_lines")
      .select(
        "id, document_number, name, metadata, revenue_before_vat, revenue, usage_rights_amount, agency_fee_amount, agency_fee_percent, revenue_vat_percent, revenue_vat_exempt, currency_code, sort_order"
      )
      .eq("campaign_header_id", typedCio.campaign_header_id)
      .order("sort_order", { ascending: true }),
    profilePromise,
  ]);

  if (!campaign || !client) {
    throw new Error("Missing campaign or client data for Client IO");
  }

  const typedCampaignRaw = campaign as {
    id: string;
    document_number: string;
    name: string;
    description: string | null;
    brief: string | null;
    start_date: string | null;
    end_date: string | null;
    objectives: unknown;
    currency_code: string;
    brands: { name: string } | Array<{ name: string }> | null;
    clients:
      | { name: string; legal_name: string | null; country: string | null }
      | Array<{ name: string; legal_name: string | null; country: string | null }>
      | null;
  };

  const typedCampaign = {
    ...typedCampaignRaw,
    brands: unwrapRelation(typedCampaignRaw.brands),
    clients: unwrapRelation(typedCampaignRaw.clients),
  };

  const typedClient = client as {
    id: string;
    name: string;
    legal_name: string | null;
    trade_license_number: string | null;
    billing_email: string | null;
    billing_phone: string | null;
    legal_address: Record<string, unknown>;
    billing_address: Record<string, unknown>;
    city: string | null;
    country: string | null;
    payment_terms: string | null;
    metadata: Record<string, unknown>;
    client_io_terms_text: string | null;
  };

  type LineRow = {
    id: string;
    document_number: string | null;
    name: string;
    metadata: Record<string, unknown> | null;
    revenue_before_vat: number | null;
    revenue: number | null;
    usage_rights_amount: number | null;
    agency_fee_amount: number | null;
    agency_fee_percent: number | null;
    revenue_vat_percent: number | null;
    revenue_vat_exempt: boolean | null;
    currency_code: string;
  };

  const typedLines = (lines ?? []) as LineRow[];
  const lineIds = typedLines.map((line) => line.id);

  const { data: deliverables } = lineIds.length
    ? await supabase
        .from("assignment_deliverables")
        .select(
          "platform, deliverable_type, quantity, live_date, campaign_line_id, sort_order"
        )
        .in("campaign_line_id", lineIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const lineContext = new Map<
    string,
    {
      influencerName: string;
      handleByPlatform: Map<string, string>;
    }
  >();

  for (const line of typedLines) {
    const assignment = parseLineAssignment(line.metadata);
    const handleByPlatform = new Map(
      (assignment?.platforms ?? []).map((platform) => [
        platform.platform.toLowerCase(),
        `@${platform.handle.replace(/^@/, "")}`,
      ])
    );
    lineContext.set(line.id, {
      influencerName: assignment?.influencer_name ?? line.name,
      handleByPlatform,
    });
  }

  const deliverableRows: ClientIoDeliverableRow[] = (deliverables ?? []).map((row) => {
    const typed = row as {
      platform: string;
      deliverable_type: string;
      quantity: number;
      live_date: string | null;
      campaign_line_id: string;
    };
    const context = lineContext.get(typed.campaign_line_id);
    const handle =
      context?.handleByPlatform.get(typed.platform.toLowerCase()) ??
      context?.handleByPlatform.values().next().value ??
      "—";

    return {
      influencerName: context?.influencerName ?? "—",
      platform: typed.platform,
      deliverableType: deliverableLabel(typed.deliverable_type),
      quantity: typed.quantity,
      handle,
      scheduledDates: typed.live_date
        ? new Date(`${typed.live_date}T00:00:00`).toLocaleDateString("en-GB")
        : "—",
    };
  });

  deliverableRows.sort((a, b) => {
    const byName = a.influencerName.localeCompare(b.influencerName);
    if (byName !== 0) return byName;
    return a.platform.localeCompare(b.platform);
  });

  const mainAssignmentDeliverables: ClientIoDeliverableRow[] = typedLines.map((line) => {
    const assignment = parseLineAssignment(line.metadata);
    const platforms = assignment?.platforms ?? [];
    const childRows = (deliverables ?? []).filter((row) => {
      const typed = row as { campaign_line_id: string };
      return typed.campaign_line_id === line.id;
    });
    const liveDates = childRows
      .map((row) => (row as { live_date: string | null }).live_date)
      .filter((value): value is string => Boolean(value))
      .sort();

    let scheduledDates = "—";
    if (liveDates.length === 1) {
      scheduledDates = new Date(`${liveDates[0]}T00:00:00`).toLocaleDateString("en-GB");
    } else if (liveDates.length > 1) {
      const first = new Date(`${liveDates[0]}T00:00:00`).toLocaleDateString("en-GB");
      const last = new Date(`${liveDates[liveDates.length - 1]}T00:00:00`).toLocaleDateString(
        "en-GB"
      );
      scheduledDates = `${first} – ${last}`;
    }

    const platformsLabel =
      platforms.length > 1
        ? platforms.map((entry) => platformLabel(entry.platform)).join(", ")
        : platforms[0]
          ? platformLabel(platforms[0].platform)
          : "—";

    const primaryHandle = platforms[0]
      ? `@${platforms[0].handle.replace(/^@/, "")}`
      : (lineContext.get(line.id)?.handleByPlatform.values().next().value ?? "—");

    const packageLabel = line.document_number
      ? `${line.document_number} Package`
      : assignment
        ? buildLineTitle(assignment.influencer_name, platforms)
        : line.name;

    return {
      influencerName: assignment?.influencer_name ?? line.name,
      platform: platformsLabel,
      deliverableType: packageLabel,
      quantity: 1,
      handle: primaryHandle,
      scheduledDates,
    };
  });

  const assignmentPricing: ClientIoAssignmentPricing[] = typedLines.map((line) => {
    const assignment = parseLineAssignment(line.metadata);
    const revenueBeforeVat = roundMoney(
      Math.max(0, Number(line.revenue_before_vat ?? line.revenue ?? 0))
    );
    const usageRightsAmount = roundMoney(Math.max(0, Number(line.usage_rights_amount ?? 0)));
    const agencyFeeAmount = resolveLineAgencyFeeAmount({
      revenueBeforeVat,
      usageRightsAmount,
      agencyFeeAmount:
        line.agency_fee_amount != null ? Number(line.agency_fee_amount) : null,
      agencyFeePercent: Number(line.agency_fee_percent ?? 0),
    });

    return {
      lineId: line.id,
      lineDocumentNumber: line.document_number,
      lineName: line.name,
      influencerName: assignment?.influencer_name ?? line.name,
      revenueBeforeVat,
      usageRightsAmount,
      agencyFeeAmount,
    };
  });

  const primaryLine = typedLines[0];
  const vatPercent =
    Number(primaryLine?.revenue_vat_percent ?? 0) || THINKWAY_AGENCY_DEFAULTS.defaultVatPercent;
  const vatExempt = Boolean(primaryLine?.revenue_vat_exempt);
  const currencyCode =
    primaryLine?.currency_code ?? typedCampaign.currency_code ?? "EGP";

  const pricing = buildCampaignPricing(
    assignmentPricing,
    currencyCode,
    vatPercent,
    vatExempt
  );

  const platforms = [...new Set(deliverableRows.map((row) => row.platform))];
  const clientMetadata = typedClient.metadata ?? {};
  const contactPerson =
    (typeof clientMetadata.primary_contact === "string" &&
      clientMetadata.primary_contact.trim()) ||
    (typeof clientMetadata.contact_name === "string" && clientMetadata.contact_name.trim()) ||
    null;

  const paymentSchedule =
    typedCio.billing_terms?.trim() ||
    formatPaymentTermsLabel(typedClient.payment_terms) ||
    "Advance — Prior to campaign launch";

  const terms = resolveEffectiveTerms(
    CLIENT_IO_DEFAULT_TERMS,
    parseTermsText(typedClient.client_io_terms_text),
    parseTermsText(typedCio.terms_text)
  );

  const profile = profileResult.data as {
    full_name: string | null;
    email: string | null;
    job_title: string | null;
  } | null;

  const agencyContact = {
    fullName: profile?.full_name?.trim() || THINKWAY_AGENCY_DEFAULTS.authorizedSignatory,
    title: profile?.job_title?.trim() || THINKWAY_AGENCY_DEFAULTS.authorizedTitle,
    email: profile?.email?.trim() || THINKWAY_AGENCY_DEFAULTS.email,
  };

  return {
    clientIoId: typedCio.id,
    documentNumber: typedCio.document_number ?? "CIO-PENDING",
    issuedAt: typedCio.created_at,
    issuedCountry: typedClient.country ?? typedCampaign.clients?.country ?? THINKWAY_AGENCY_DEFAULTS.country,
    currencyCode,
    status: typedCio.status,
    paymentSchedule,
    agencyContact,
    terms,
    client: {
      id: typedClient.id,
      name: typedClient.name,
      legalName: typedClient.legal_name,
      tradeLicense: typedClient.trade_license_number,
      address: formatClientAddress({
        legalAddress: typedClient.legal_address,
        billingAddress: typedClient.billing_address,
        city: typedClient.city,
        country: typedClient.country,
      }),
      contactPerson,
      email: typedClient.billing_email,
    },
    campaign: {
      id: typedCampaign.id,
      documentNumber: typedCampaign.document_number,
      name: typedCampaign.name,
      startDate: typedCampaign.start_date,
      endDate: typedCampaign.end_date,
      brandName: typedCampaign.brands?.name ?? "—",
      channels: platforms.map(platformLabel).join(", ") || "—",
      targetMarket: typedClient.country ?? typedCampaign.clients?.country ?? THINKWAY_AGENCY_DEFAULTS.country,
      businessObjective:
        typedCampaign.description?.trim() ||
        typedCampaign.brief?.trim() ||
        formatObjectives(typedCampaign.objectives),
      usagePeriod: typedCio.billing_terms?.trim() || null,
    },
    deliverables: deliverableRows,
    mainAssignmentDeliverables,
    pricing,
  };
}
