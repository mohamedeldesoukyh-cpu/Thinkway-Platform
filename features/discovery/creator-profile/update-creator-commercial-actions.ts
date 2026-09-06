"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FieldSourceMap } from "@/lib/creator-enrichment/types";
import {
  normalizeContactEmail,
  normalizeContactLinks,
  normalizeContactPhone,
  resolveCreatorContactFields,
} from "@/lib/creators/contact-info";
import {
  CREATOR_PR_CATEGORY,
  withPrCategoryToggled,
} from "@/lib/creators/category-keywords";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreatorCommercialActionResult = {
  ok: boolean;
  message: string;
  creator?: UnifiedCreatorResult | null;
};

const contactSchema = z.object({
  influencerId: z.string().uuid(),
  unifiedId: z.string().trim().min(1),
  email: z
    .string()
    .trim()
    .max(320)
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  phone: z.string().trim().max(40),
  linksText: z.string().trim().max(2000),
});

const averagePriceSchema = z.object({
  influencerId: z.string().uuid(),
  unifiedId: z.string().trim().min(1),
  amount: z.preprocess((value) => {
    if (value === "" || value == null) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }, z.number().min(0, "Price cannot be negative").optional()),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Enter a valid currency")
    .default(DEFAULT_PLATFORM_CURRENCY),
});

const prCategorySchema = z.object({
  influencerId: z.string().uuid(),
  unifiedId: z.string().trim().min(1),
  enabled: z.boolean(),
});

async function requireAuthedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase: null, error: "Unauthorized" as const };
  }
  return { supabase, error: null };
}

function parseLinksText(linksText: string): string[] {
  return normalizeContactLinks(
    linksText
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function withManualContactSources(
  existing: FieldSourceMap | null | undefined,
  fields: Array<"contact_email" | "contact_phone" | "contact_links">
): FieldSourceMap {
  const next: FieldSourceMap = { ...(existing ?? {}) };
  for (const field of fields) {
    next[field] = "manual";
  }
  return next;
}

async function reloadCreator(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAuthedClient>>["supabase"]>,
  unifiedId: string
): Promise<UnifiedCreatorResult | null> {
  return getUnifiedCreatorById(supabase, unifiedId.trim());
}

/**
 * Persist creator contact on vendor master + all platform accounts.
 * Marks platform contact fields as `manual` so enrichment will not overwrite them.
 */
export async function updateCreatorContactDetailsAction(input: {
  influencerId: string;
  unifiedId: string;
  email: string;
  phone: string;
  linksText: string;
}): Promise<CreatorCommercialActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid contact details.",
    };
  }

  const { supabase, error: authError } = await requireAuthedClient();
  if (!supabase || authError) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const contact = resolveCreatorContactFields({
    contact_email: normalizeContactEmail(parsed.data.email),
    contact_phone: normalizeContactPhone(parsed.data.phone),
    contact_links: parseLinksText(parsed.data.linksText),
  });

  const { error: influencerError } = await supabase
    .from("influencers")
    .update({
      email: contact.contact_email,
      phone: contact.contact_phone,
    })
    .eq("id", parsed.data.influencerId);

  if (influencerError) {
    return { ok: false, message: influencerError.message };
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, field_sources")
    .eq("influencer_id", parsed.data.influencerId);

  if (accountsError) {
    return { ok: false, message: accountsError.message };
  }

  for (const account of accounts ?? []) {
    const fieldSources = withManualContactSources(
      (account.field_sources as FieldSourceMap | null) ?? null,
      ["contact_email", "contact_phone", "contact_links"]
    );
    const { error: updateError } = await supabase
      .from("influencer_platform_accounts")
      .update({
        contact_email: contact.contact_email,
        contact_phone: contact.contact_phone,
        contact_links: contact.contact_links,
        field_sources: fieldSources,
      })
      .eq("id", account.id);

    if (updateError) {
      return { ok: false, message: updateError.message };
    }
  }

  const creator = await reloadCreator(supabase, parsed.data.unifiedId);
  revalidatePath(`/vendors/${parsed.data.influencerId}`);
  revalidatePath("/discovery");

  return {
    ok: true,
    message: "Contact details saved.",
    creator,
  };
}

/**
 * Persist average price per content on `influencers.rate_card`.
 * Studio / assignment cost suggestions already prefer quotation averages, then this rate card.
 */
export async function updateCreatorAveragePriceAction(input: {
  influencerId: string;
  unifiedId: string;
  amount?: number | null;
  currency: string;
}): Promise<CreatorCommercialActionResult> {
  const parsed = averagePriceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid price.",
    };
  }

  const { supabase, error: authError } = await requireAuthedClient();
  if (!supabase || authError) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const rateCard =
    parsed.data.amount != null
      ? {
          base_rate: parsed.data.amount,
          currency: parsed.data.currency,
        }
      : {};

  const { error } = await supabase
    .from("influencers")
    .update({ rate_card: rateCard })
    .eq("id", parsed.data.influencerId);

  if (error) {
    return { ok: false, message: error.message };
  }

  const creator = await reloadCreator(supabase, parsed.data.unifiedId);
  revalidatePath(`/vendors/${parsed.data.influencerId}`);
  revalidatePath("/discovery");

  return {
    ok: true,
    message: "Average price per content saved.",
    creator,
  };
}

/**
 * Toggle the canonical `PR` category on `influencers.categories`.
 * Adds or removes PR alongside existing tags — never replaces the list.
 * Search/filter already match free-form categories (FTS + browse overlaps).
 */
export async function updateCreatorPrCategoryAction(input: {
  influencerId: string;
  unifiedId: string;
  enabled: boolean;
}): Promise<CreatorCommercialActionResult> {
  const parsed = prCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid PR category update.",
    };
  }

  const { supabase, error: authError } = await requireAuthedClient();
  if (!supabase || authError) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: row, error: readError } = await supabase
    .from("influencers")
    .select("categories")
    .eq("id", parsed.data.influencerId)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }
  if (!row) {
    return { ok: false, message: "Creator profile not found." };
  }

  const existing = Array.isArray(row.categories)
    ? (row.categories as string[])
    : [];
  const nextCategories = withPrCategoryToggled(existing, parsed.data.enabled);

  const { error } = await supabase
    .from("influencers")
    .update({ categories: nextCategories })
    .eq("id", parsed.data.influencerId);

  if (error) {
    return { ok: false, message: error.message };
  }

  const creator = await reloadCreator(supabase, parsed.data.unifiedId);
  revalidatePath(`/vendors/${parsed.data.influencerId}`);
  revalidatePath("/discovery");

  return {
    ok: true,
    message: parsed.data.enabled
      ? `${CREATOR_PR_CATEGORY} category added.`
      : `${CREATOR_PR_CATEGORY} category removed.`,
    creator,
  };
}
