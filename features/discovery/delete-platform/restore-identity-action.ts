"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { SHORTLIST_PERMISSIONS } from "@/features/discovery/shortlists/constants";
import { requirePermission } from "@/lib/auth/permissions-server";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function restoreCreatorIdentityAction(influencerId: string) {
  const id = z.uuid().parse(influencerId);
  const db = await createSupabaseServerClient();
  const auth = await requirePermission(db, SHORTLIST_PERMISSIONS.write);
  if ("error" in auth) throw new Error(auth.error);
  await persistCreatorPrimaryIdentity(db, id, { resetFromLinkedAccounts: true });
  const creator = await getUnifiedCreatorById(db, `inf:${id}`);
  if (!creator) throw new Error("Could not reload creator identity.");
  revalidatePath("/discovery/search");
  return creator;
}
