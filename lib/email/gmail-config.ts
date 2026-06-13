import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";

export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fromEmail: string;
  fromName: string;
};

export function getGmailFromEmail(): string {
  return (
    process.env.GMAIL_FROM_EMAIL?.trim() ||
    process.env.THINKWAY_IO_FROM_EMAIL?.trim() ||
    THINKWAY_AGENCY_DEFAULTS.email
  );
}

export function getGmailConfig(): GmailConfig | null {
  const clientId = process.env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    fromEmail: getGmailFromEmail(),
    fromName: process.env.GMAIL_FROM_NAME?.trim() || "Thinkway",
  };
}

export function isGmailConfigured(): boolean {
  return getGmailConfig() !== null;
}
