import { NextResponse, type NextRequest } from "next/server";

import {
  CREATOR_SOCIAL_CANCELLED,
  CREATOR_SOCIAL_DENIED,
  CREATOR_SOCIAL_INVALID_STATE,
} from "@/lib/creator-social/copy";
import { creatorSocialCallbackPath } from "@/lib/creator-social/config";
import { upsertActiveConnection } from "@/lib/creator-social/connections/service";
import { consumeBoundOAuthState } from "@/lib/creator-social/oauth/state";
import { getSocialProvider } from "@/lib/creator-social/providers/registry";
import { enqueueCreatorSocialSync } from "@/lib/creator-social/sync/queue";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

function profileRedirect(origin: string, status: string) {
  const url = new URL("/creator-portal/profile", origin);
  url.searchParams.set("social", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const rate = consumeRateLimit({
    category: "public",
    identity: `creator-social-callback:${request.headers.get("x-forwarded-for") ?? "ip"}`,
  });
  if (!rate.allowed) {
    return profileRedirect(origin, "error");
  }

  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const code = searchParams.get("code");

  if (error === "access_denied") {
    return profileRedirect(origin, "denied");
  }
  if (error) {
    return profileRedirect(origin, "cancelled");
  }
  if (!state) {
    return profileRedirect(origin, "invalid");
  }
  if (!code) {
    return profileRedirect(origin, "cancelled");
  }

  const db = tryCreateServiceRoleClient().client;
  if (!db) {
    return profileRedirect(origin, "error");
  }

  const consumed = await consumeBoundOAuthState(db, { state });
  if (!consumed.ok) {
    return profileRedirect(origin, consumed.reason);
  }

  const provider = getSocialProvider(consumed.data.provider);
  const redirectUri = `${origin.replace(/\/$/, "")}${creatorSocialCallbackPath()}`;

  try {
    const tokens = await provider.exchangeCode({
      code,
      redirectUri,
      codeVerifier: consumed.data.codeVerifier,
    });
    const identity = await provider.fetchIdentity(tokens);
    const saved = await upsertActiveConnection({
      supabase: db,
      influencerId: consumed.data.influencerId,
      provider: provider.id,
      identity,
      tokens,
      scopes: provider.scopes,
      capabilities: provider.capabilities,
    });
    await enqueueCreatorSocialSync({
      connectionId: saved.connectionId,
      influencerId: consumed.data.influencerId,
      trigger: "initial",
    });
    return profileRedirect(origin, "connected");
  } catch {
    return profileRedirect(origin, "error");
  }
}
