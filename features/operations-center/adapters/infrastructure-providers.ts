import {
  checkRedisHealth,
  isRedisConfigured,
} from "@/lib/performance/campaign-performance-queues";
import { PUBLICATION_MEDIA_BUCKET } from "@/lib/performance/screenshot-capture/config";
import { getBuildInfo } from "@/lib/deploy/build-info";

import type { HealthProvider } from "./types";
import { resultBase, scoreFromStatus, statusFromLatency } from "./types";

export const nextJsProvider: HealthProvider = {
  id: "nextjs",
  name: "Next.js App",
  kind: "infrastructure",
  weight: 1.2,
  async check() {
    const started = performance.now();
    const build = getBuildInfo();
    const latencyMs = Math.round(performance.now() - started);
    return resultBase(this, {
      status: "healthy",
      latencyMs,
      message: `App process healthy · ${build.environment} · ${build.gitShaShort ?? "local"}`,
      lastSuccessAt: new Date().toISOString(),
      meta: { build },
    });
  },
};

export const vercelProvider: HealthProvider = {
  id: "vercel",
  name: "Vercel deployment",
  kind: "infrastructure",
  weight: 0.8,
  async check() {
    const env = process.env.VERCEL_ENV?.trim();
    const url = process.env.VERCEL_URL?.trim();
    const token = process.env.VERCEL_API_TOKEN?.trim();
    if (!env && !url) {
      return resultBase(this, {
        status: "unknown",
        latencyMs: null,
        message: "Not running on Vercel (or env metadata unavailable).",
      });
    }
    if (!token) {
      return resultBase(this, {
        status: "healthy",
        latencyMs: null,
        message: `Deploy metadata present (${env ?? "unknown"}) — API token not configured for live checks.`,
        meta: { env, url },
        score: 85,
      });
    }
    // Token present: lightweight self-check without calling Vercel REST in this sprint
    return resultBase(this, {
      status: "healthy",
      latencyMs: null,
      message: `Vercel ${env} · token configured for future Deploy API adapter.`,
      meta: { env, url },
    });
  },
};

export const supabaseProvider: HealthProvider = {
  id: "supabase",
  name: "Supabase",
  kind: "infrastructure",
  weight: 1.5,
  async check(ctx) {
    if (!ctx.supabase) {
      return resultBase(this, {
        status: "unknown",
        latencyMs: null,
        message: "Supabase client not provided.",
      });
    }
    const started = performance.now();
    try {
      const { error } = await ctx.supabase.from("profiles").select("id").limit(1);
      const latencyMs = Math.round(performance.now() - started);
      if (error) {
        return resultBase(this, {
          status: "critical",
          latencyMs,
          message: error.message,
          lastFailureAt: new Date().toISOString(),
          lastFailure: error.message,
        });
      }
      const status = statusFromLatency(latencyMs, { warnMs: 400, criticalMs: 1500 });
      return resultBase(this, {
        status,
        latencyMs,
        message: "Database reachable.",
        lastSuccessAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return resultBase(this, {
        status: "offline",
        latencyMs: null,
        message,
        lastFailure: message,
        lastFailureAt: new Date().toISOString(),
      });
    }
  },
};

export const redisProvider: HealthProvider = {
  id: "redis",
  name: "Redis",
  kind: "infrastructure",
  weight: 1.3,
  async check() {
    if (!isRedisConfigured()) {
      return resultBase(this, {
        status: "warning",
        latencyMs: null,
        message: "REDIS_URL not configured — queues/workers unavailable.",
        score: scoreFromStatus("warning"),
      });
    }
    const health = await checkRedisHealth();
    if (!health.connected) {
      return resultBase(this, {
        status: "offline",
        latencyMs: health.latencyMs,
        message: health.error ?? "Redis unreachable",
        lastFailure: health.error ?? "Redis unreachable",
        lastFailureAt: new Date().toISOString(),
      });
    }
    const status = statusFromLatency(health.latencyMs, {
      warnMs: 120,
      criticalMs: 500,
    });
    return resultBase(this, {
      status,
      latencyMs: health.latencyMs,
      message: "Redis PING ok",
      lastSuccessAt: new Date().toISOString(),
    });
  },
};

export const storageProvider: HealthProvider = {
  id: "storage",
  name: "Supabase Storage",
  kind: "storage",
  weight: 1,
  async check(ctx) {
    if (!ctx.supabase) {
      return resultBase(this, {
        status: "unknown",
        latencyMs: null,
        message: "Supabase client not provided.",
      });
    }
    const started = performance.now();
    try {
      const { error } = await ctx.supabase.storage
        .from(PUBLICATION_MEDIA_BUCKET)
        .list("", { limit: 1 });
      const latencyMs = Math.round(performance.now() - started);
      if (error) {
        return resultBase(this, {
          status: "critical",
          latencyMs,
          message: error.message,
          lastFailure: error.message,
          lastFailureAt: new Date().toISOString(),
          meta: { bucket: PUBLICATION_MEDIA_BUCKET },
        });
      }
      return resultBase(this, {
        status: statusFromLatency(latencyMs),
        latencyMs,
        message: `Bucket ${PUBLICATION_MEDIA_BUCKET} reachable`,
        lastSuccessAt: new Date().toISOString(),
        meta: { bucket: PUBLICATION_MEDIA_BUCKET },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return resultBase(this, {
        status: "offline",
        latencyMs: null,
        message,
        lastFailure: message,
        lastFailureAt: new Date().toISOString(),
      });
    }
  },
};

export const realtimeProvider: HealthProvider = {
  id: "realtime",
  name: "Supabase Realtime",
  kind: "infrastructure",
  weight: 0.6,
  async check() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!url) {
      return resultBase(this, {
        status: "unknown",
        latencyMs: null,
        message: "Supabase URL not configured.",
      });
    }
    // Connectivity inferred from REST; dedicated websocket probe is a future adapter.
    return resultBase(this, {
      status: "healthy",
      latencyMs: null,
      message: "Realtime endpoint assumed available with Supabase project.",
      score: 80,
      meta: { note: "WebSocket probe not yet implemented" },
    });
  },
};

export const bullMqProvider: HealthProvider = {
  id: "bullmq",
  name: "BullMQ",
  kind: "queue",
  weight: 1.2,
  async check() {
    if (!isRedisConfigured()) {
      return resultBase(this, {
        status: "offline",
        latencyMs: null,
        message: "BullMQ unavailable — Redis not configured.",
      });
    }
    const redis = await checkRedisHealth();
    if (!redis.connected) {
      return resultBase(this, {
        status: "offline",
        latencyMs: redis.latencyMs,
        message: "BullMQ offline — Redis down.",
        lastFailure: redis.error ?? "Redis down",
        lastFailureAt: new Date().toISOString(),
      });
    }
    return resultBase(this, {
      status: "healthy",
      latencyMs: redis.latencyMs,
      message: "Queue broker reachable via Redis.",
      lastSuccessAt: new Date().toISOString(),
    });
  },
};
