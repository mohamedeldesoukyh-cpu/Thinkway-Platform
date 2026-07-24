import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

test("createSupabaseAdminClient module is server-only", () => {
  const src = readFileSync(join(repoRoot, "lib/supabase/admin.ts"), "utf8");
  assert.match(src, /import\s+["']server-only["']/);
});

test("service-role client is not imported from Client Components", () => {
  const offenders: string[] = [];
  const roots = ["app", "components", "features"].map((d) => join(repoRoot, d));

  for (const root of roots) {
    for (const file of walkTs(root)) {
      const text = readFileSync(file, "utf8");
      const isClient =
        /^["']use client["']/.test(text.trimStart()) ||
        text.includes('\n"use client"') ||
        text.includes("\n'use client'");
      if (!isClient) continue;
      if (
        text.includes("createSupabaseAdminClient") ||
        text.includes("SUPABASE_SERVICE_ROLE_KEY")
      ) {
        offenders.push(file.replace(repoRoot, "").replace(/\\/g, "/"));
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Service role leaked into client components:\n${offenders.join("\n")}`,
  );
});

test("NEXT_PUBLIC_ must not expose service role key name as a public env binding", () => {
  const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8");
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_.*SERVICE_ROLE/);
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY/);
});
