/**
 * Shared external URL validation for storage and render (SEC-002).
 * Rejects unsafe schemes; normalizes https/http URLs before persist.
 * Distinct from SSRF host allowlists in ssrf.ts (outbound fetch).
 */

import { z } from "zod";

export const UNSAFE_URL_SCHEMES = [
  "javascript:",
  "data:",
  "vbscript:",
  "file:",
  "blob:",
  "about:",
  "chrome:",
  "chrome-extension:",
] as const;

export type SafeExternalUrlOptions = {
  /** When true, allow http:// in addition to https://. Default false. */
  allowHttp?: boolean;
  /** When true, allow mailto: (contact links). Default false. */
  allowMailto?: boolean;
  /** Promote bare domains / www. to https:// before validation. Default false. */
  promoteBareDomain?: boolean;
  /** Max length after trim. Default 2048. */
  maxLength?: number;
};

export type SafeExternalUrlSuccess = {
  ok: true;
  url: string;
};

export type SafeExternalUrlFailure = {
  ok: false;
  error: string;
};

export type SafeExternalUrlResult = SafeExternalUrlSuccess | SafeExternalUrlFailure;

function stripControls(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function decodeCandidates(value: string): string[] {
  const out = [value];
  try {
    const once = decodeURIComponent(value);
    if (once !== value) out.push(once);
    const twice = decodeURIComponent(once);
    if (twice !== once) out.push(twice);
  } catch {
    // malformed percent-encoding — still validate the raw string
  }
  return out;
}

function containsUnsafeScheme(value: string): boolean {
  const collapsed = value.toLowerCase().replace(/[\s\u0000-\u001f\u007f]+/g, "");
  return UNSAFE_URL_SCHEMES.some(
    (scheme) =>
      collapsed.startsWith(scheme) ||
      collapsed.includes(`:${scheme}`) ||
      collapsed.includes(`=${scheme}`)
  );
}

function promoteBareDomain(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  if (
    trimmed.includes(".") &&
    !trimmed.includes("@") &&
    !trimmed.includes(" ") &&
    !trimmed.startsWith("/") &&
    !trimmed.includes("://")
  ) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Parse and normalize a user-supplied absolute external URL.
 * Relative paths, unsafe schemes, and empty values fail.
 */
export function parseSafeExternalUrl(
  raw: string | null | undefined,
  options: SafeExternalUrlOptions = {}
): SafeExternalUrlResult {
  const allowHttp = options.allowHttp === true;
  const allowMailto = options.allowMailto === true;
  const maxLength = options.maxLength ?? 2048;

  if (raw == null) {
    return { ok: false, error: "URL is required." };
  }

  let trimmed = stripControls(String(raw));
  if (!trimmed) {
    return { ok: false, error: "URL is required." };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, error: "URL is too long." };
  }

  if (options.promoteBareDomain) {
    trimmed = promoteBareDomain(trimmed);
  }

  for (const candidate of decodeCandidates(trimmed)) {
    if (containsUnsafeScheme(candidate)) {
      return { ok: false, error: "URL scheme is not allowed." };
    }
  }

  // Relative / protocol-relative / scheme-relative without host
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("//")
  ) {
    return { ok: false, error: "Relative URLs are not allowed." };
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return { ok: false, error: "URL must include an absolute scheme." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }

  const protocol = parsed.protocol.toLowerCase();

  if (containsUnsafeScheme(protocol) || UNSAFE_URL_SCHEMES.includes(protocol as (typeof UNSAFE_URL_SCHEMES)[number])) {
    return { ok: false, error: "URL scheme is not allowed." };
  }

  if (protocol === "mailto:") {
    if (!allowMailto) {
      return { ok: false, error: "mailto: links are not allowed here." };
    }
    const address = parsed.href.slice("mailto:".length).split("?")[0]?.trim();
    if (!address || !address.includes("@")) {
      return { ok: false, error: "Enter a valid mailto: address." };
    }
    return { ok: true, url: `mailto:${address}` };
  }

  if (protocol === "https:") {
    if (!parsed.hostname) {
      return { ok: false, error: "URL must include a hostname." };
    }
    return { ok: true, url: parsed.href };
  }

  if (protocol === "http:") {
    if (!allowHttp) {
      return { ok: false, error: "URL must use https." };
    }
    if (!parsed.hostname) {
      return { ok: false, error: "URL must include a hostname." };
    }
    return { ok: true, url: parsed.href };
  }

  return { ok: false, error: "URL scheme is not allowed." };
}

/**
 * Empty / whitespace → null success. Non-empty must pass parseSafeExternalUrl.
 */
export function parseOptionalSafeExternalUrl(
  raw: string | null | undefined,
  options: SafeExternalUrlOptions = {}
): { ok: true; url: string | null } | SafeExternalUrlFailure {
  if (raw == null) {
    return { ok: true, url: null };
  }
  const trimmed = stripControls(String(raw));
  if (!trimmed) {
    return { ok: true, url: null };
  }
  const parsed = parseSafeExternalUrl(trimmed, options);
  if (!parsed.ok) return parsed;
  return { ok: true, url: parsed.url };
}

/**
 * Render-time href guard. Returns null when the value must not be used as href.
 * Does not promote bare domains (stored values should already be normalized).
 */
export function toSafeHref(
  raw: string | null | undefined,
  options: SafeExternalUrlOptions = {}
): string | null {
  const parsed = parseOptionalSafeExternalUrl(raw, {
    ...options,
    promoteBareDomain: false,
  });
  if (!parsed.ok) return null;
  return parsed.url;
}

export function isSafeExternalUrl(
  raw: string | null | undefined,
  options: SafeExternalUrlOptions = {}
): boolean {
  return parseSafeExternalUrl(raw, options).ok;
}

/** Zod helper — https by default; pass options for http/mailto. */
export function safeExternalUrlZod(options: SafeExternalUrlOptions = {}) {
  return z.string().trim().superRefine((value, ctx) => {
    const result = parseSafeExternalUrl(value, options);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    }
  }).transform((value) => {
    const result = parseSafeExternalUrl(value, options);
    if (!result.ok) return value;
    return result.url;
  });
}

export function optionalSafeExternalUrlZod(options: SafeExternalUrlOptions = {}) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return "";
      return String(value).trim();
    },
    z
      .string()
      .max(options.maxLength ?? 2048)
      .superRefine((value, ctx) => {
        if (!value) return;
        const result = parseSafeExternalUrl(value, options);
        if (!result.ok) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
        }
      })
      .transform((value) => {
        if (!value) return "";
        const result = parseSafeExternalUrl(value, options);
        return result.ok ? result.url : value;
      })
  );
}
