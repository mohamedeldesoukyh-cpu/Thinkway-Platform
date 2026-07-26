/**
 * Client-side parsing of API error JSON + rate-limit headers.
 * Prefer human `message` over machine `error` codes for UI display.
 */

export type ParsedApiError = {
  /** User-facing message (never a raw machine code when a message exists). */
  message: string;
  /** Machine code from JSON body when present (e.g. rate_limit_exceeded). */
  code?: string;
  status: number;
  retryAfterSec?: number;
  category?: string;
  limit?: number;
};

function parseRetryAfterSec(response: Response, bodyRetry?: number): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header) {
    const asInt = Number.parseInt(header, 10);
    if (Number.isFinite(asInt) && asInt > 0) return asInt;
    const asDate = Date.parse(header);
    if (Number.isFinite(asDate)) {
      return Math.max(1, Math.ceil((asDate - Date.now()) / 1000));
    }
  }
  if (typeof bodyRetry === "number" && Number.isFinite(bodyRetry) && bodyRetry > 0) {
    return Math.ceil(bodyRetry);
  }
  return undefined;
}

function friendlyRateLimitMessage(input: {
  category?: string;
  retryAfterSec?: number;
  fallback?: string;
}): string {
  const wait =
    input.retryAfterSec != null && input.retryAfterSec > 0
      ? ` Try again in ${input.retryAfterSec}s.`
      : " Please wait a moment and try again.";
  if (input.category === "ai") {
    return `You're sending AI requests too quickly.${wait}`;
  }
  return input.fallback?.trim() || `Too many requests.${wait}`;
}

export async function parseApiError(
  response: Response,
  fallback = "Request failed"
): Promise<ParsedApiError> {
  const text = await response.text();
  let code: string | undefined;
  let bodyMessage: string | undefined;
  let category: string | undefined;
  let limit: number | undefined;
  let bodyRetry: number | undefined;

  if (text.trim()) {
    try {
      const payload = JSON.parse(text) as {
        error?: string;
        message?: string;
        category?: string;
        limit?: number;
        retryAfterSec?: number;
      };
      code = typeof payload.error === "string" ? payload.error : undefined;
      bodyMessage = typeof payload.message === "string" ? payload.message : undefined;
      category = typeof payload.category === "string" ? payload.category : undefined;
      limit = typeof payload.limit === "number" ? payload.limit : undefined;
      bodyRetry =
        typeof payload.retryAfterSec === "number" ? payload.retryAfterSec : undefined;
    } catch {
      return {
        status: response.status,
        message: text.slice(0, 200) || fallback,
      };
    }
  }

  const retryAfterSec = parseRetryAfterSec(response, bodyRetry);

  if (response.status === 429 || code === "rate_limit_exceeded") {
    return {
      status: response.status,
      code: code ?? "rate_limit_exceeded",
      category,
      limit,
      retryAfterSec,
      message: friendlyRateLimitMessage({
        category,
        retryAfterSec,
        fallback: bodyMessage,
      }),
    };
  }

  // Prefer human message; never surface a bare machine code when message exists.
  const message =
    bodyMessage?.trim() ||
    (code && !/^[a-z0-9_]+$/i.test(code) ? code : undefined) ||
    (code ? fallback : undefined) ||
    fallback;

  return {
    status: response.status,
    code,
    category,
    limit,
    retryAfterSec,
    message,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
