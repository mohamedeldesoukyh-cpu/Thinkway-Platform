import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function runGuards(env: Record<string, string>): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  const script = `
    process.env.THINKWAY_ENV = ${JSON.stringify(env.THINKWAY_ENV ?? "")};
    process.env.NEXT_PUBLIC_SUPABASE_URL = ${JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? "")};
    process.env.SUPABASE_SERVICE_ROLE_KEY = ${JSON.stringify(env.SUPABASE_SERVICE_ROLE_KEY ?? "")};
    process.env.REDIS_URL = ${JSON.stringify(env.REDIS_URL ?? "")};
    process.env.EXPECTED_SUPABASE_PROJECT_REF = ${JSON.stringify(env.EXPECTED_SUPABASE_PROJECT_REF ?? "")};
    process.env.EXPECTED_REDIS_HOST = ${JSON.stringify(env.EXPECTED_REDIS_HOST ?? "")};
    const { assertWorkerRuntimeGuards } = await import(${JSON.stringify(
      "./services/discovery-worker/src/runtime-guards.ts",
    )});
    assertWorkerRuntimeGuards();
    console.log("GUARDS_OK");
  `;
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...env },
      windowsHide: true,
    },
  );
  return {
    status: r.status,
    stderr: r.stderr || "",
    stdout: r.stdout || "",
  };
}

function fakeJwt(ref: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ ref, role: "service_role" })).toString(
    "base64url",
  );
  return `${header}.${payload}.sig`;
}

test("production guards pass with Prod Supabase + expected Redis host", () => {
  const r = runGuards({
    THINKWAY_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://ienowhwfyxoqtzbgltno.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: fakeJwt("ienowhwfyxoqtzbgltno"),
    REDIS_URL: "redis://default:x@sakura.proxy.rlwy.net:39697",
    EXPECTED_REDIS_HOST: "sakura.proxy.rlwy.net",
    EXPECTED_SUPABASE_PROJECT_REF: "ienowhwfyxoqtzbgltno",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout + r.stderr, /Production runtime guards OK/);
});

test("production guards abort on Development Supabase", () => {
  const r = runGuards({
    THINKWAY_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://hsxrewjcbvmbkqdlzjhs.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: fakeJwt("hsxrewjcbvmbkqdlzjhs"),
    REDIS_URL: "redis://default:x@sakura.proxy.rlwy.net:39697",
    EXPECTED_REDIS_HOST: "sakura.proxy.rlwy.net",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /STARTUP ABORT/);
});

test("production guards abort on Dev Upstash Redis", () => {
  const r = runGuards({
    THINKWAY_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://ienowhwfyxoqtzbgltno.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: fakeJwt("ienowhwfyxoqtzbgltno"),
    REDIS_URL: "rediss://default:x@saved-opossum-86561.upstash.io:6379",
    EXPECTED_REDIS_HOST: "sakura.proxy.rlwy.net",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Development Upstash|does not match EXPECTED_REDIS_HOST/);
});

test("development guards abort on Production Supabase", () => {
  const r = runGuards({
    THINKWAY_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: "https://ienowhwfyxoqtzbgltno.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: fakeJwt("ienowhwfyxoqtzbgltno"),
    REDIS_URL: "rediss://default:x@saved-opossum-86561.upstash.io:6379",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /must not use Production Supabase|Development requires/);
});
