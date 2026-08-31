import type { SocialProviderId } from "../ids";

export type SocialCapability =
  | "account_identity"
  | "publication_metrics"
  | "content_insights"
  | "audience_insights";

export type SocialTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  tokenType: string | null;
};

export type SocialAccountIdentity = {
  externalAccountId: string;
  username: string | null;
  displayName: string | null;
};

export type SocialAuthorizationInput = {
  state: string;
  redirectUri: string;
  codeChallenge: string | null;
};

export type SocialTokenExchangeInput = {
  code: string;
  redirectUri: string;
  codeVerifier: string | null;
};

export type SocialProvider = {
  id: SocialProviderId;
  displayName: string;
  usesPkce: boolean;
  scopes: readonly string[];
  capabilities: readonly SocialCapability[];
  isConfigured: () => boolean;
  buildAuthorizationUrl: (input: SocialAuthorizationInput) => string;
  exchangeCode: (input: SocialTokenExchangeInput) => Promise<SocialTokenSet>;
  fetchIdentity: (tokens: SocialTokenSet) => Promise<SocialAccountIdentity>;
  refreshTokens?: (tokens: SocialTokenSet) => Promise<SocialTokenSet>;
  revoke?: (tokens: SocialTokenSet) => Promise<void>;
  syncInsights?: (
    tokens: SocialTokenSet
  ) => Promise<import("../insights/types").NormalizedSocialInsight[]>;
};
