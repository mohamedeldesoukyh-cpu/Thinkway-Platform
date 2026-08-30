"use server";

import { revalidatePath } from "next/cache";

import { requireCreatorScope } from "@/features/portals/scope";
import {
  CREATOR_SOCIAL_INTERNAL_ONLY_CONNECT,
  CREATOR_SOCIAL_PROVIDER_UNAVAILABLE,
} from "@/lib/creator-social/copy";
import { isSocialProviderId } from "@/lib/creator-social/ids";
import { creatorSocialCallbackPath } from "@/lib/creator-social/config";
import {
  disconnectConnection,
  listConnectionsForInfluencer,
  requireOwnedConnection,
} from "@/lib/creator-social/connections/service";
import { createBoundOAuthState } from "@/lib/creator-social/oauth/state";
import { getSocialProvider } from "@/lib/creator-social/providers/registry";
import { enqueueCreatorSocialSync } from "@/lib/creator-social/sync/queue";
import { buildCreatorSocialProviderViews } from "@/lib/creator-social/views";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { resolveWorkspaceActor } from "@/lib/security/workspace-actor";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

export type CreatorSocialActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function requireCreatorSocialActor() {
  const scoped = await requireCreatorScope("creator_portal.write");
  const workspace = await resolveWorkspaceActor(scoped.supabase, scoped.scope.userId);
  if (workspace.kind !== "creator_portal") {
    return { ok: false as const, message: CREATOR_SOCIAL_INTERNAL_ONLY_CONNECT };
  }
  const db = tryCreateServiceRoleClient().client;
  if (!db) {
    return { ok: false as const, message: "Creator Workspace is temporarily unavailable." };
  }
  return { ok: true as const, scoped, db };
}

export async function loadCreatorSocialProviderViews() {
  const scoped = await requireCreatorScope("creator_portal.read");
  const db = tryCreateServiceRoleClient().client;
  const connections = db
    ? await listConnectionsForInfluencer(db, scoped.scope.influencerId)
    : [];
  return buildCreatorSocialProviderViews(connections);
}

export async function startCreatorSocialConnectAction(input: {
  provider: string;
}): Promise<CreatorSocialActionResult<{ authorizeUrl: string }>> {
  const access = await requireCreatorSocialActor();
  if (!access.ok) return access;
  if (!isSocialProviderId(input.provider)) {
    return { ok: false, message: CREATOR_SOCIAL_PROVIDER_UNAVAILABLE };
  }

  const rate = consumeRateLimit({
    category: "auth",
    identity: `creator-social:${access.scoped.scope.userId}`,
  });
  if (!rate.allowed) {
    return { ok: false, message: "Please wait a moment before connecting again." };
  }

  const provider = getSocialProvider(input.provider);
  if (!provider.isConfigured()) {
    return { ok: false, message: CREATOR_SOCIAL_PROVIDER_UNAVAILABLE };
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_DEVELOPMENT_APP_URL?.trim() ||
    "";
  if (!origin) {
    return { ok: false, message: "Social connections are not ready in this environment." };
  }

  const created = await createBoundOAuthState(access.db, {
    influencerId: access.scoped.scope.influencerId,
    provider: provider.id,
    usesPkce: provider.usesPkce,
  });
  const authorizeUrl = provider.buildAuthorizationUrl({
    state: created.state,
    redirectUri: `${origin.replace(/\/$/, "")}${creatorSocialCallbackPath()}`,
    codeChallenge: created.codeChallenge,
  });
  return { ok: true, data: { authorizeUrl } };
}

export async function disconnectCreatorSocialConnectionAction(input: {
  connectionId: string;
}): Promise<CreatorSocialActionResult<null>> {
  const access = await requireCreatorSocialActor();
  if (!access.ok) return access;
  const result = await disconnectConnection({
    supabase: access.db,
    connectionId: input.connectionId,
    influencerId: access.scoped.scope.influencerId,
  });
  if (!result.ok) return result;
  revalidatePath("/creator-portal");
  revalidatePath("/creator-portal/profile");
  return { ok: true, data: null };
}

export async function syncCreatorSocialConnectionAction(input: {
  connectionId: string;
}): Promise<CreatorSocialActionResult<null>> {
  const access = await requireCreatorSocialActor();
  if (!access.ok) return access;
  const owned = await requireOwnedConnection(
    access.db,
    input.connectionId,
    access.scoped.scope.influencerId
  );
  if (!owned || owned.status === "disconnected") {
    return { ok: false, message: "Connection not found." };
  }
  const queued = await enqueueCreatorSocialSync({
    connectionId: owned.id,
    influencerId: owned.influencer_id,
    trigger: "manual",
  });
  if (!queued.queued && queued.reason !== "already_queued") {
    return { ok: false, message: "Sync could not start. Try again shortly." };
  }
  revalidatePath("/creator-portal/profile");
  return { ok: true, data: null };
}
