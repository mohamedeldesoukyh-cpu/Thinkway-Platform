import type { HealthProvider } from "./types";
import { resultBase } from "./types";

function configHealthProvider(
  id: string,
  name: string,
  configured: () => boolean,
  detail: () => string,
): HealthProvider {
  return {
    id,
    name,
    kind: "integration",
    weight: 0.7,
    async check() {
      const ok = configured();
      return resultBase(this, {
        status: ok ? "healthy" : "unknown",
        latencyMs: null,
        message: detail(),
        lastSuccessAt: ok ? new Date().toISOString() : null,
        meta: { configured: ok },
        score: ok ? 90 : 50,
      });
    },
  };
}

export const apifyProvider: HealthProvider = {
  id: "apify",
  name: "Apify",
  kind: "integration",
  weight: 1,
  async check() {
    const token = Boolean(
      process.env.APIFY_TOKEN?.trim() || process.env.APIFY_API_TOKEN?.trim(),
    );
    if (!token) {
      return resultBase(this, {
        status: "unknown",
        latencyMs: null,
        message: "APIFY_TOKEN not configured.",
      });
    }
    return resultBase(this, {
      status: "healthy",
      latencyMs: null,
      message: "Apify token configured.",
      lastSuccessAt: new Date().toISOString(),
      meta: { token: true },
    });
  },
};

export const resendProvider = configHealthProvider(
  "resend",
  "Resend",
  () => Boolean(process.env.RESEND_API_KEY?.trim()),
  () =>
    process.env.RESEND_API_KEY?.trim()
      ? "Resend API key configured."
      : "RESEND_API_KEY not configured.",
);

export const smtpProvider = configHealthProvider(
  "smtp",
  "SMTP",
  () =>
    Boolean(
      process.env.SMTP_HOST?.trim() &&
        (process.env.SMTP_USER?.trim() || process.env.SMTP_PASSWORD?.trim()),
    ),
  () =>
    process.env.SMTP_HOST?.trim()
      ? `SMTP host ${process.env.SMTP_HOST}`
      : "SMTP not configured.",
);

export const googleOAuthProvider = configHealthProvider(
  "google-oauth",
  "Google OAuth",
  () =>
    Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim(),
    ),
  () =>
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
      ? "Google OAuth client configured."
      : "Google OAuth client id not configured.",
);

export const metaProvider = configHealthProvider(
  "meta",
  "Meta",
  () =>
    Boolean(
      process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim(),
    ),
  () =>
    process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim()
      ? "Meta app credentials configured."
      : "Meta app credentials not configured.",
);

export const tiktokProvider = configHealthProvider(
  "tiktok",
  "TikTok",
  () => Boolean(process.env.TIKTOK_CLIENT_KEY?.trim()),
  () =>
    process.env.TIKTOK_CLIENT_KEY?.trim()
      ? "TikTok client key configured."
      : "TikTok client key not configured.",
);

export const youtubeProvider = configHealthProvider(
  "youtube",
  "YouTube",
  () =>
    Boolean(
      process.env.YOUTUBE_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim(),
    ),
  () =>
    process.env.YOUTUBE_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
      ? "YouTube / Google API key configured."
      : "YouTube API key not configured.",
);
