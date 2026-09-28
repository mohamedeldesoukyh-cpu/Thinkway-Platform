"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COUNTRY_OPTIONS } from "@/features/vendors/constants";
import { countryWritePayload, persistInfluencerCountryFields } from "@/lib/creators/country-persistence";

export async function loadCreatorCountry(creatorId: string) {
  if (!z.string().uuid().safeParse(creatorId).success) throw new Error("Invalid creator.");
  const db = await createSupabaseServerClient();
  const permission = await requirePermission(db, "influencers.read");
  if ("error" in permission) throw new Error(permission.error);
  const { data, error } = await db.from("influencers").select("country_code").eq("id", creatorId).single();
  if (error) throw new Error(error.message);
  const write = await requirePermission(db, "influencers.write");
  return { country: data.country_code ?? "", canEdit: !("error" in write) };
}

export async function saveCreatorCountry(creatorId: string, country: string) {
  if (!z.string().uuid().safeParse(creatorId).success || !COUNTRY_OPTIONS.some((option) => option.value === country)) {
    throw new Error("Select a valid creator country.");
  }
  const db = await createSupabaseServerClient();
  const permission = await requirePermission(db, "influencers.write");
  if ("error" in permission) throw new Error(permission.error);
  const { data, error } = await db.from("influencers").select("country_code, country_codes").eq("id", creatorId).single();
  if (error) throw new Error(error.message);
  const write = persistInfluencerCountryFields({
    existingCountryCode: data.country_code,
    existingCountryCodes: data.country_codes,
    incomingCodes: [country],
    preferredPrimary: country,
    preserveExistingPrimary: false,
  });
  const result = await db.from("influencers").update(countryWritePayload(write)).eq("id", creatorId).select("country_code").single();
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${creatorId}`);
  revalidatePath("/campaigns", "layout");
  return result.data.country_code ?? country;
}
