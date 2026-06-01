"use server";

import {
  findDuplicateBrand,
  findDuplicateClient,
  findDuplicateGroup,
} from "@/lib/validation/checks";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgencyOrDirect } from "@/types/database";

export type NameAvailabilityResult = {
  available: boolean;
  message?: string;
};

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return supabase;
}

export async function checkGroupNameAvailable(
  name: string,
  excludeGroupId?: string
): Promise<NameAvailabilityResult> {
  const supabase = await requireAuth();
  const message = await findDuplicateGroup(supabase, name, excludeGroupId);
  return message ? { available: false, message } : { available: true };
}

export async function checkClientNameAvailable(
  name: string,
  agencyOrDirect: string,
  excludeClientId?: string
): Promise<NameAvailabilityResult> {
  const supabase = await requireAuth();
  const message = await findDuplicateClient(
    supabase,
    name,
    agencyOrDirect as AgencyOrDirect,
    excludeClientId
  );
  return message ? { available: false, message } : { available: true };
}

export async function checkBrandNameAvailable(
  name: string,
  clientId: string,
  excludeBrandId?: string
): Promise<NameAvailabilityResult> {
  const supabase = await requireAuth();
  const message = await findDuplicateBrand(
    supabase,
    name,
    clientId,
    excludeBrandId || undefined
  );
  return message ? { available: false, message } : { available: true };
}
