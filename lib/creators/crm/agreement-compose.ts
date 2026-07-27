/**
 * Compose Vendor IO terms from Thinkway defaults + client + brand requirements.
 * Reuses existing IO terms text model — not a parallel agreement engine.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { serializeTermsText } from "@/lib/io/client-io-terms";
import { VENDOR_IO_DEFAULT_TERMS } from "@/lib/io/vendor-io-default-terms";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type ComposedAgreement = {
  termsText: string;
  sources: {
    thinkwayDefault: boolean;
    clientRequirements: boolean;
    brandRequirements: boolean;
    savedTemplate: boolean;
  };
  templateId: string | null;
};

function clausesToBlock(title: string, clauses: unknown): string {
  if (!Array.isArray(clauses) || clauses.length === 0) return "";
  const lines = clauses
    .map((c, i) => {
      if (typeof c === "string") return `${i + 1}. ${c}`;
      if (c && typeof c === "object" && "text" in c) {
        return `${i + 1}. ${String((c as { text: unknown }).text)}`;
      }
      return null;
    })
    .filter(Boolean);
  if (!lines.length) return "";
  return `\n\n## ${title}\n${lines.join("\n")}`;
}

export async function composeCreatorAgreementTerms(
  supabase: Supabase,
  input: {
    influencerId: string;
    clientId: string;
    brandId?: string | null;
    preferSavedTemplate?: boolean;
  }
): Promise<ComposedAgreement> {
  const brandId = input.brandId ?? null;

  if (input.preferSavedTemplate !== false) {
    let templateQuery = supabase
      .from("creator_agreement_templates")
      .select("id, terms_text")
      .eq("influencer_id", input.influencerId)
      .eq("client_id", input.clientId)
      .limit(1);
    templateQuery = brandId
      ? templateQuery.eq("brand_id", brandId)
      : templateQuery.is("brand_id", null);
    const { data: template } = await templateQuery.maybeSingle();
    if (template?.terms_text) {
      return {
        termsText: template.terms_text,
        sources: {
          thinkwayDefault: false,
          clientRequirements: false,
          brandRequirements: false,
          savedTemplate: true,
        },
        templateId: template.id,
      };
    }
  }

  const [{ data: clientReq }, { data: brandReq }] = await Promise.all([
    supabase
      .from("client_commercial_requirements")
      .select(
        "legal_clauses, payment_rules, usage_rights, exclusivity_notes, confidentiality_notes"
      )
      .eq("client_id", input.clientId)
      .maybeSingle(),
    brandId
      ? supabase
          .from("brand_commercial_requirements")
          .select("extra_legal_clauses, notes")
          .eq("brand_id", brandId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let terms = serializeTermsText(VENDOR_IO_DEFAULT_TERMS).trim();
  const client = clientReq;
  const brand = brandReq;

  if (client) {
    terms += clausesToBlock("Client requirements", client.legal_clauses);
    if (client.usage_rights?.trim()) {
      terms += `\n\n## Usage rights\n${client.usage_rights.trim()}`;
    }
    if (client.exclusivity_notes?.trim()) {
      terms += `\n\n## Exclusivity\n${client.exclusivity_notes.trim()}`;
    }
    if (client.confidentiality_notes?.trim()) {
      terms += `\n\n## Confidentiality\n${client.confidentiality_notes.trim()}`;
    }
  }
  if (brand) {
    terms += clausesToBlock("Brand requirements", brand.extra_legal_clauses);
    if (brand.notes?.trim()) {
      terms += `\n\n## Brand notes\n${brand.notes.trim()}`;
    }
  }

  return {
    termsText: terms,
    sources: {
      thinkwayDefault: true,
      clientRequirements: Boolean(client),
      brandRequirements: Boolean(brand),
      savedTemplate: false,
    },
    templateId: null,
  };
}

export async function saveCreatorAgreementTemplate(
  supabase: Supabase,
  input: {
    influencerId: string;
    clientId: string;
    brandId?: string | null;
    termsText: string;
    actorId: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  const brandId = input.brandId ?? null;

  let existingQuery = supabase
    .from("creator_agreement_templates")
    .select("id")
    .eq("influencer_id", input.influencerId)
    .eq("client_id", input.clientId)
    .limit(1);
  existingQuery = brandId
    ? existingQuery.eq("brand_id", brandId)
    : existingQuery.is("brand_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("creator_agreement_templates")
      .update({
        terms_text: input.termsText,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { id: existing.id };
  }

  const { data, error } = await supabase
    .from("creator_agreement_templates")
    .insert({
      influencer_id: input.influencerId,
      client_id: input.clientId,
      brand_id: brandId,
      terms_text: input.termsText,
      created_by: input.actorId,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  return { id: data?.id ?? "" };
}
