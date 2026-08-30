import { isProviderIntegrationConfigured, readOAuthClientConfig } from "../config";
import type { SocialProviderId } from "../ids";
import type {
  SocialAccountIdentity,
  SocialAuthorizationInput,
  SocialCapability,
  SocialProvider,
  SocialTokenExchangeInput,
  SocialTokenSet,
} from "./types";

function notConfigured(): never {
  throw new Error("This social provider is not configured yet.");
}

function buildOAuth2AuthorizeUrl(
  endpoint: string,
  input: SocialAuthorizationInput & {
    clientId: string;
    scopes: readonly string[];
    extra?: Record<string, string>;
  }
): string {
  const url = new URL(endpoint);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  if (input.scopes.length > 0) {
    url.searchParams.set("scope", input.scopes.join(" "));
  }
  if (input.codeChallenge) {
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  for (const [key, value] of Object.entries(input.extra ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function postForm(
  endpoint: string,
  body: Record<string, string>
): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error("The platform could not complete authorization.");
  }
  return json;
}

function tokenSetFromJson(json: Record<string, unknown>): SocialTokenSet {
  const accessToken =
    typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) {
    throw new Error("The platform did not return an access token.");
  }
  const expiresIn = Number(json.expires_in);
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    tokenType: typeof json.token_type === "string" ? json.token_type : null,
    expiresAt: Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null,
  };
}

function createSoonProvider(input: {
  id: SocialProviderId;
  displayName: string;
  usesPkce: boolean;
  scopes: readonly string[];
  capabilities: readonly SocialCapability[];
  authorizationEndpoint: string;
  tokenEndpoint: string;
  extraAuthorize?: Record<string, string>;
  adapterReady?: boolean;
  fetchIdentity: (tokens: SocialTokenSet) => Promise<SocialAccountIdentity>;
}): SocialProvider {
  return {
    id: input.id,
    displayName: input.displayName,
    usesPkce: input.usesPkce,
    scopes: input.scopes,
    capabilities: input.capabilities,
    isConfigured: () =>
      Boolean(input.adapterReady) && isProviderIntegrationConfigured(input.id),
    buildAuthorizationUrl: (auth) => {
      const client = readOAuthClientConfig(input.id);
      if (!client) notConfigured();
      return buildOAuth2AuthorizeUrl(input.authorizationEndpoint, {
        ...auth,
        clientId: client.clientId,
        scopes: input.scopes,
        extra: input.extraAuthorize,
      });
    },
    exchangeCode: async (exchange: SocialTokenExchangeInput) => {
      const client = readOAuthClientConfig(input.id);
      if (!client) notConfigured();
      const json = await postForm(input.tokenEndpoint, {
        client_id: client.clientId,
        client_secret: client.clientSecret,
        grant_type: "authorization_code",
        code: exchange.code,
        redirect_uri: exchange.redirectUri,
        ...(exchange.codeVerifier ? { code_verifier: exchange.codeVerifier } : {}),
      });
      return tokenSetFromJson(json);
    },
    fetchIdentity: input.fetchIdentity,
  };
}

async function instagramIdentity(tokens: SocialTokenSet): Promise<SocialAccountIdentity> {
  const url = new URL("https://graph.instagram.com/v21.0/me");
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", tokens.accessToken);
  const response = await fetch(url);
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof json.id !== "string") {
    throw new Error("Could not read the Instagram account.");
  }
  return {
    externalAccountId: json.id,
    username: typeof json.username === "string" ? json.username : null,
    displayName: typeof json.name === "string" ? json.name : null,
  };
}

const INSTAGRAM: SocialProvider = createSoonProvider({
  id: "instagram",
  displayName: "Instagram",
  usesPkce: true,
  scopes: ["instagram_business_basic", "instagram_business_manage_insights"],
  capabilities: ["account_identity", "publication_metrics", "content_insights"],
  authorizationEndpoint: "https://www.instagram.com/oauth/authorize",
  tokenEndpoint: "https://api.instagram.com/oauth/access_token",
  adapterReady: true,
  fetchIdentity: instagramIdentity,
});

const TIKTOK: SocialProvider = createSoonProvider({
  id: "tiktok",
  displayName: "TikTok",
  usesPkce: true,
  scopes: ["user.info.basic", "video.list"],
  capabilities: ["account_identity", "publication_metrics", "content_insights"],
  authorizationEndpoint: "https://www.tiktok.com/v2/auth/authorize/",
  tokenEndpoint: "https://open.tiktokapis.com/v2/oauth/token/",
  fetchIdentity: async () => notConfigured(),
});

const YOUTUBE: SocialProvider = createSoonProvider({
  id: "youtube",
  displayName: "YouTube",
  usesPkce: true,
  scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
  capabilities: ["account_identity", "publication_metrics", "content_insights"],
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  extraAuthorize: { access_type: "offline", prompt: "consent" },
  fetchIdentity: async () => notConfigured(),
});

const FACEBOOK: SocialProvider = createSoonProvider({
  id: "facebook",
  displayName: "Facebook",
  usesPkce: true,
  scopes: ["pages_show_list", "pages_read_engagement"],
  capabilities: ["account_identity", "publication_metrics"],
  authorizationEndpoint: "https://www.facebook.com/v21.0/dialog/oauth",
  tokenEndpoint: "https://graph.facebook.com/v21.0/oauth/access_token",
  fetchIdentity: async () => notConfigured(),
});

const TWITTER: SocialProvider = createSoonProvider({
  id: "twitter",
  displayName: "X",
  usesPkce: true,
  scopes: ["tweet.read", "users.read", "offline.access"],
  capabilities: ["account_identity", "publication_metrics"],
  authorizationEndpoint: "https://twitter.com/i/oauth2/authorize",
  tokenEndpoint: "https://api.twitter.com/2/oauth2/token",
  fetchIdentity: async () => notConfigured(),
});

const SNAPCHAT: SocialProvider = createSoonProvider({
  id: "snapchat",
  displayName: "Snapchat",
  usesPkce: true,
  scopes: ["snapchat-marketing-api"],
  capabilities: ["account_identity"],
  authorizationEndpoint: "https://accounts.snapchat.com/login/oauth2/authorize",
  tokenEndpoint: "https://accounts.snapchat.com/login/oauth2/access_token",
  fetchIdentity: async () => notConfigured(),
});

const LINKEDIN: SocialProvider = createSoonProvider({
  id: "linkedin",
  displayName: "LinkedIn",
  usesPkce: true,
  scopes: ["openid", "profile"],
  capabilities: ["account_identity"],
  authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
  tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
  fetchIdentity: async () => notConfigured(),
});

const PINTEREST: SocialProvider = createSoonProvider({
  id: "pinterest",
  displayName: "Pinterest",
  usesPkce: true,
  scopes: ["user_accounts:read"],
  capabilities: ["account_identity"],
  authorizationEndpoint: "https://www.pinterest.com/oauth/",
  tokenEndpoint: "https://api.pinterest.com/v5/oauth/token",
  fetchIdentity: async () => notConfigured(),
});

const PROVIDERS: Record<SocialProviderId, SocialProvider> = {
  instagram: INSTAGRAM,
  tiktok: TIKTOK,
  youtube: YOUTUBE,
  facebook: FACEBOOK,
  twitter: TWITTER,
  snapchat: SNAPCHAT,
  linkedin: LINKEDIN,
  pinterest: PINTEREST,
};

export function listSocialProviders(): SocialProvider[] {
  return Object.values(PROVIDERS);
}

export function getSocialProvider(id: SocialProviderId): SocialProvider {
  return PROVIDERS[id];
}
