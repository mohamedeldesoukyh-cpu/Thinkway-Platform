import "server-only";

import { requirePermission } from "@/lib/auth/permissions-server";
import { requireCreatorScope } from "@/features/portals/scope";
import { requireRequestUser } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import { assembleCreatorInsightPack } from "./assemble";
import {
  fingerprintCreatorInsightInputs,
  invalidateCreatorInsightCache,
  readCreatorInsightCache,
  writeCreatorInsightCache,
} from "./cache";
import { loadCreatorInsightFacts, unitStampFromUpcoming } from "./load";
import type { CreatorInsightPack, UpcomingCreatorUnit } from "./types";

function serviceDb() {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Creator insights are temporarily unavailable.");
  }
  return service;
}

export async function computeCreatorInsightPack(input: {
  influencerId: string;
  units?: readonly UpcomingCreatorUnit[];
}): Promise<CreatorInsightPack> {
  const facts = await loadCreatorInsightFacts(serviceDb(), input.influencerId);
  const fingerprint = fingerprintCreatorInsightInputs({
    influencerId: input.influencerId,
    publicationStamp: facts.publicationStamp,
    insightStamp: facts.insightStamp,
    syncStamp: facts.syncStamp,
    unitStamp: unitStampFromUpcoming(input.units ?? []),
  });
  const cached = readCreatorInsightCache(input.influencerId, fingerprint);
  if (cached) return cached;
  const pack = await assembleCreatorInsightPack({
    influencerId: input.influencerId,
    observations: facts.observations,
    units: input.units,
    connections: facts.connections,
    hasOperationalHistory: facts.hasOperationalHistory,
  });
  writeCreatorInsightCache(input.influencerId, fingerprint, pack);
  return pack;
}

/** Creator Workspace: ownership is the authenticated influencer, never a client-supplied id. */
export async function loadOwnCreatorInsightPack(
  units?: readonly UpcomingCreatorUnit[]
): Promise<CreatorInsightPack> {
  const { scope } = await requireCreatorScope("creator_portal.read");
  return computeCreatorInsightPack({ influencerId: scope.influencerId, units });
}

/** Internal Creator Profile. Portal actors cannot call this. */
export async function loadInternalCreatorInsightPack(
  influencerId: string
): Promise<CreatorInsightPack> {
  const { supabase } = await requireRequestUser();
  const auth = await requirePermission(supabase, "influencers.read");
  if ("error" in auth) {
    throw new Error(auth.error);
  }
  return computeCreatorInsightPack({ influencerId });
}

export { invalidateCreatorInsightCache };
