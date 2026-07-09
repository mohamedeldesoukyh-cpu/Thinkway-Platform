import fs from "node:fs";
import path from "node:path";

const root = "c:/thinkway-platform/app/api";

const patches = [
  { glob: "reports", suffix: "/document/route.ts", permission: "analytics.read" },
  { file: "reports/daily/drilldown/route.ts", permission: "analytics.read" },
  { file: "discovery/search/route.ts", permission: "discovery.read" },
  { file: "discovery/jobs/route.ts", permission: "discovery.read" },
  { file: "discovery/jobs/[id]/route.ts", permission: "discovery.read" },
  { file: "discovery/import/files/route.ts", permission: "discovery.write" },
  { file: "discovery/compare/document/route.ts", permission: "discovery.read" },
  { file: "shortlists/[id]/export/route.ts", permission: "discovery.read", audit: "shortlist" },
  { file: "quotations/[id]/export/route.ts", permission: "discovery.read", audit: "quotation" },
  { file: "invoices/[id]/document/route.ts", permission: "invoices.read" },
  { file: "client-ios/[id]/document/route.ts", permission: "client_ios.read" },
  { file: "vendor-ios/[id]/document/route.ts", permission: "vendor_ios.read" },
  { file: "clients/[clientId]/documents/route.ts", permission: "clients.write", auditUpload: true },
  { file: "creators/avatar/route.ts", permission: "influencers.read" },
  { file: "creators/publication-preview/route.ts", permission: "publications.read" },
  { file: "campaigns/[id]/publications-bundle/route.ts", permission: "campaigns.read" },
  { file: "campaigns/[id]/performance/document/route.ts", permission: "analytics.read" },
];

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === "route.ts") acc.push(p);
  }
  return acc;
}

const allRoutes = walk(root);

const authBlock =
  /const supabase = await createSupabaseServerClient\(\);\s*const \{\s*data: \{ user \},(?:\s*error(?:: authError)?,)?\s*\} = await supabase\.auth\.getUser\(\);\s*\n\s*if \((?:authError \|\| )?!user\) \{\s*return NextResponse\.json\([^)]+\{ status: 401 \}\);\s*\}/s;

const authBlockAlt =
  /const supabase = await createSupabaseServerClient\(\);\s*const \{\s*data: \{ user \},\s*\} = await supabase\.auth\.getUser\(\);\s*\n\s*if \(!user\) \{\s*return NextResponse\.json\(\{ ok: false, message: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/s;

function addImports(content, withAudit) {
  if (content.includes("requireApiPermission")) return content;
  const lines = withAudit
    ? [
        'import { getClientIp, requireApiPermission } from "@/lib/auth/api-auth";',
        'import { logAuditEvent } from "@/lib/audit/log-audit-event";',
      ]
    : ['import { requireApiPermission } from "@/lib/auth/api-auth";'];
  return content.replace(
    /import \{ createSupabaseServerClient \} from "@\/lib\/supabase\/server";/,
    `${lines.join("\n")}\nimport { createSupabaseServerClient } from "@/lib/supabase/server";`
  );
}

function patchStandard(file, permission, opts = {}) {
  let content = fs.readFileSync(file, "utf8");
  if (content.includes("requireApiPermission")) {
    console.log("SKIP", file);
    return;
  }

  content = addImports(content, opts.audit || opts.auditUpload);

  const replacement = `const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "${permission}");
  if ("response" in auth) return auth.response;`;

  if (authBlock.test(content)) {
    content = content.replace(authBlock, replacement);
  } else if (authBlockAlt.test(content)) {
    content = content.replace(authBlockAlt, replacement);
  } else {
    console.log("NO MATCH", file);
    return;
  }

  if (opts.audit) {
    content = content.replace(
      /if \(!detail\) \{\s*return NextResponse\.json\(\{ error: "[^"]+" \}, \{ status: 404 \}\);\s*\}/,
      `$&

    void logAuditEvent(supabase, {
      userId: auth.userId,
      action: "export",
      entityType: "${opts.audit}",
      entityId: id,
      metadata: { format, download },
      ip: getClientIp(request),
    });`
    );
  }

  if (opts.auditUpload) {
    content = content.replace(
      /const result = await persistClientDocumentUpload\(/,
      `void logAuditEvent(supabase, {
      userId: auth.userId,
      action: "document.upload",
      entityType: "client",
      entityId: routeClientId,
      metadata: { documentType },
      ip: getClientIp(request),
    });

    const result = await persistClientDocumentUpload(`
    );
  }

  fs.writeFileSync(file, content);
  console.log("PATCHED", file);
}

for (const patch of patches) {
  let targets = [];
  if (patch.file) {
    targets = [path.join(root, ...patch.file.split("/"))];
  } else if (patch.glob && patch.suffix) {
    targets = allRoutes.filter(
      (r) => r.includes(`${patch.glob}${patch.suffix.replace(/\//g, path.sep)}`) ||
        (r.includes(`${patch.glob}`) && r.endsWith("document\\route.ts"))
    );
    targets = allRoutes.filter((r) => {
      const rel = path.relative(root, r).replace(/\\/g, "/");
      return rel.startsWith(`${patch.glob}/`) && rel.endsWith(patch.suffix);
    });
  }

  for (const file of targets) {
    if (!fs.existsSync(file)) {
      console.log("MISSING", file);
      continue;
    }
    patchStandard(file, patch.permission, patch);
  }
}

// campaigns/influencers
{
  const file = path.join(root, "campaigns/influencers/route.ts");
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("requireApiPermission")) {
    content = addImports(content, false) + "";
    content = content.replace(
      "export async function GET(request: Request) {",
      `export async function GET(request: Request) {
  const supabaseAuth = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabaseAuth, "influencers.read");
  if ("response" in auth) return auth.response;
`
    );
    content = content.replace(
      "    if (mode === \"browse\") {\n      const supabase = await createSupabaseServerClient();",
      '    if (mode === "browse") {\n      const supabase = supabaseAuth;'
    );
    content = content.replace(
      "export async function POST(request: Request) {",
      `export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "influencers.read");
  if ("response" in auth) return auth.response;
`
    );
    fs.writeFileSync(file, content);
    console.log("PATCHED", file);
  }
}

// operations routes
for (const rel of [
  "operations/campaigns/route.ts",
  "operations/vendors/[id]/assignments/route.ts",
]) {
  const file = path.join(root, ...rel.split("/"));
  let content = fs.readFileSync(file, "utf8");
  if (content.includes("requireApiPermission")) continue;
  if (!content.includes("createSupabaseServerClient")) {
    content = `import { requireApiPermission } from "@/lib/auth/api-auth";\nimport { createSupabaseServerClient } from "@/lib/supabase/server";\n` + content;
  } else {
    content = addImports(content, false);
  }
  content = content.replace(
    /export async function GET\(([^)]*)\) \{/,
    `export async function GET($1) {
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "operations.read");
  if ("response" in auth) return auth.response;
`
  );
  fs.writeFileSync(file, content);
  console.log("PATCHED", file);
}
