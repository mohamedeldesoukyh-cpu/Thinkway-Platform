import type { HealthProvider } from "./types";
import { resultBase } from "./types";
import { withDiagnostics } from "../health/diagnostics";

function emailReason(configured: boolean, provider: "resend" | "smtp"): {
  status: "healthy" | "unknown";
  reason: string;
  suggestedAction: string;
} {
  if (!configured) {
    if (provider === "resend") {
      return {
        status: "unknown",
        reason: "API key missing — RESEND_API_KEY is not configured.",
        suggestedAction:
          "Set RESEND_API_KEY (or configure SMTP) before relying on transactional email in production.",
      };
    }
    return {
      status: "unknown",
      reason: "No provider configured — SMTP_HOST / credentials are missing.",
      suggestedAction:
        "Configure SMTP_HOST and credentials, or set RESEND_API_KEY as the primary email provider.",
    };
  }
  return {
    status: "healthy",
    reason:
      provider === "resend"
        ? "Provider healthy — Resend API key is configured (live send probe not run)."
        : "Provider healthy — SMTP host is configured (live send probe not run).",
    suggestedAction:
      "Optional: add a lightweight provider reachability probe if email delivery incidents are common.",
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
      return withDiagnostics(
        resultBase(this, {
          status: "unknown",
          latencyMs: null,
          message: "APIFY_TOKEN not configured.",
        }),
        {
          reason: "API key missing — APIFY_TOKEN / APIFY_API_TOKEN not set.",
          suggestedAction:
            "Set APIFY_TOKEN for Discovery scraping integrations, or accept Discovery without Apify.",
          technicalDetails: { configured: false },
        },
      );
    }
    return withDiagnostics(
      resultBase(this, {
        status: "healthy",
        latencyMs: null,
        message: "Apify token configured.",
        lastSuccessAt: new Date().toISOString(),
        meta: { token: true },
      }),
      {
        reason: "Provider healthy — Apify token is configured (live API probe not run).",
        technicalDetails: { configured: true },
      },
    );
  },
};

export const resendProvider: HealthProvider = {
  id: "resend",
  name: "Resend (Email)",
  kind: "integration",
  weight: 0.7,
  async check() {
    const configured = Boolean(process.env.RESEND_API_KEY?.trim());
    const { status, reason, suggestedAction } = emailReason(configured, "resend");
    return withDiagnostics(
      resultBase(this, {
        status,
        latencyMs: null,
        message: reason,
        lastSuccessAt: configured ? new Date().toISOString() : null,
        meta: { configured, provider: "resend" },
        score: configured ? 90 : 50,
      }),
      {
        reason,
        suggestedAction,
        technicalDetails: {
          provider: "resend",
          configured,
          authConfigured: configured,
          liveProbe: false,
        },
      },
    );
  },
};

export const smtpProvider: HealthProvider = {
  id: "smtp",
  name: "SMTP (Email)",
  kind: "integration",
  weight: 0.7,
  async check() {
    const configured = Boolean(
      process.env.SMTP_HOST?.trim() &&
        (process.env.SMTP_USER?.trim() || process.env.SMTP_PASSWORD?.trim()),
    );
    const { status, reason, suggestedAction } = emailReason(configured, "smtp");
    return withDiagnostics(
      resultBase(this, {
        status,
        latencyMs: null,
        message: process.env.SMTP_HOST?.trim()
          ? `SMTP host ${process.env.SMTP_HOST}`
          : reason,
        lastSuccessAt: configured ? new Date().toISOString() : null,
        meta: { configured, provider: "smtp", host: process.env.SMTP_HOST ?? null },
        score: configured ? 90 : 50,
      }),
      {
        reason,
        suggestedAction,
        technicalDetails: {
          provider: "smtp",
          configured,
          host: process.env.SMTP_HOST?.trim() || null,
          liveProbe: false,
        },
      },
    );
  },
};

function configHealthProvider(
  id: string,
  name: string,
  configured: () => boolean,
  missingReason: string,
  healthyReason: string,
): HealthProvider {
  return {
    id,
    name,
    kind: "integration",
    weight: 0.7,
    async check() {
      const ok = configured();
      return withDiagnostics(
        resultBase(this, {
          status: ok ? "healthy" : "unknown",
          latencyMs: null,
          message: ok ? healthyReason : missingReason,
          lastSuccessAt: ok ? new Date().toISOString() : null,
          meta: { configured: ok },
          score: ok ? 90 : 50,
        }),
        {
          reason: ok ? healthyReason : missingReason,
          suggestedAction: ok
            ? "No action required."
            : `Configure ${name} credentials for this environment if the feature is required.`,
          technicalDetails: { configured: ok },
        },
      );
    },
  };
}

export const googleOAuthProvider = configHealthProvider(
  "google-oauth",
  "Google OAuth",
  () =>
    Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() ||
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim(),
    ),
  "API key missing — Google OAuth client id not configured.",
  "Provider healthy — Google OAuth client configured.",
);

export const metaProvider = configHealthProvider(
  "meta",
  "Meta",
  () =>
    Boolean(
      process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim(),
    ),
  "API key missing — Meta app credentials not configured.",
  "Provider healthy — Meta app credentials configured.",
);

export const tiktokProvider = configHealthProvider(
  "tiktok",
  "TikTok",
  () => Boolean(process.env.TIKTOK_CLIENT_KEY?.trim()),
  "API key missing — TikTok client key not configured.",
  "Provider healthy — TikTok client key configured.",
);

export const youtubeProvider = configHealthProvider(
  "youtube",
  "YouTube",
  () =>
    Boolean(
      process.env.YOUTUBE_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
    ),
  "API key missing — YouTube / Google API key not configured.",
  "Provider healthy — YouTube / Google API key configured.",
);
