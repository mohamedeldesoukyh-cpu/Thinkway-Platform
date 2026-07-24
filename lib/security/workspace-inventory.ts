import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Filesystem inventory helpers for P4 completeness validation.
 * Used by tests — not imported at runtime by the app.
 */

function walk(dir: string, predicate: (name: string) => boolean): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") {
        continue;
      }
      out.push(...walk(full, predicate));
    } else if (predicate(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Convert `app/api/foo/[id]/route.ts` → `/api/foo/[id]` */
export function apiFileToPath(repoRoot: string, filePath: string): string {
  const rel = relative(join(repoRoot, "app"), filePath).replace(/\\/g, "/");
  return `/${rel.replace(/\/route\.tsx?$/, "")}`;
}

/** Convert `app/(dashboard)/finance/page.tsx` → `/finance` */
export function pageFileToPath(repoRoot: string, filePath: string): string {
  const rel = relative(join(repoRoot, "app"), filePath).replace(/\\/g, "/");
  const withoutGroups = rel
    .split("/")
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/");
  const path = `/${withoutGroups.replace(/\/page\.tsx?$/, "")}`;
  return path === "/" ? "/" : path.replace(/\/$/, "") || "/";
}

export function listApiRouteFiles(repoRoot: string): string[] {
  return walk(join(repoRoot, "app", "api"), (name) => name === "route.ts");
}

export function listPageFiles(repoRoot: string): string[] {
  return walk(join(repoRoot, "app"), (name) => name === "page.tsx");
}

export function listServerActionModules(repoRoot: string): string[] {
  const roots = [join(repoRoot, "features"), join(repoRoot, "app")];
  const files: string[] = [];
  for (const root of roots) {
    files.push(
      ...walk(root, (name) => name.endsWith(".ts") || name.endsWith(".tsx")),
    );
  }
  return files.filter((file) => {
    try {
      const head = readFileSync(file, "utf8").slice(0, 400);
      return /["']use server["']/.test(head);
    } catch {
      return false;
    }
  });
}
