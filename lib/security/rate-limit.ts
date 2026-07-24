export type RateLimitCategory =
  | "auth"
  | "ai"
  | "upload"
  | "discovery"
  | "public"
  | "invite"
  | "export"
  | "default";

export type RateLimitRule = {
  windowMs: number;
  max: number;
};

/** Per-category limits (identity = user id or IP). */
export const RATE_LIMIT_RULES: Record<RateLimitCategory, RateLimitRule> = {
  auth: { windowMs: 60_000, max: 5 },
  ai: { windowMs: 60_000, max: 10 },
  upload: { windowMs: 3_600_000, max: 20 },
  discovery: { windowMs: 60_000, max: 60 },
  public: { windowMs: 60_000, max: 120 },
  invite: { windowMs: 3_600_000, max: 10 },
  export: { windowMs: 60_000, max: 15 },
  default: { windowMs: 60_000, max: 120 },
};

type CounterEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, CounterEntry>();

/** Test helper — clears in-memory counters. */
export function resetRateLimitStoreForTests(): void {
  store.clear();
}

export type RateLimitResult = {
  allowed: boolean;
  category: RateLimitCategory;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

function pruneExpired(now: number): void {
  if (store.size < 5_000) return;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

/**
 * Sliding fixed-window counter. Suitable for single-instance / pilot;
 * prefer Redis/Upstash for multi-instance production.
 */
export function consumeRateLimit(input: {
  category: RateLimitCategory;
  identity: string;
  now?: number;
  rules?: Record<RateLimitCategory, RateLimitRule>;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  const rules = input.rules ?? RATE_LIMIT_RULES;
  const rule = rules[input.category];
  const key = `${input.category}:${input.identity}`;
  pruneExpired(now);

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + rule.windowMs };
    store.set(key, entry);
  }

  entry.count += 1;
  const allowed = entry.count <= rule.max;
  const remaining = Math.max(0, rule.max - entry.count);
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

  return {
    allowed,
    category: input.category,
    limit: rule.max,
    remaining: allowed ? remaining : 0,
    resetAt: entry.resetAt,
    retryAfterSec,
  };
}

export type RateLimitErrorBody = {
  error: "rate_limit_exceeded";
  message: string;
  category: RateLimitCategory;
  limit: number;
  retryAfterSec: number;
};

export function rateLimitExceededBody(result: RateLimitResult): RateLimitErrorBody {
  return {
    error: "rate_limit_exceeded",
    message: `Rate limit exceeded for ${result.category}. Try again in ${result.retryAfterSec}s.`,
    category: result.category,
    limit: result.limit,
    retryAfterSec: result.retryAfterSec,
  };
}
