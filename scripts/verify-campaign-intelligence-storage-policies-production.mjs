/**
 * Read-only Production verification for Campaign Intelligence document Storage RLS.
 * The invoked runner is hard-pinned to Supabase project ienowhwfyxoqtzbgltno.
 * Usage: node scripts/verify-campaign-intelligence-storage-policies-production.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const psql = resolve(root, "scripts/psql-production.mjs");
const bucketId = "campaign-intelligence-documents";
const ownershipPredicate =
  "((bucket_id='campaign-intelligence-documents'::text)and((storage.foldername(name))[1]=(auth.uid())::text))";

const expectedPolicies = new Map([
  [
    "campaign_intelligence_docs_storage_select",
    { command: "SELECT", predicateLocation: "USING" },
  ],
  [
    "campaign_intelligence_docs_storage_insert",
    { command: "INSERT", predicateLocation: "WITH CHECK" },
  ],
  [
    "campaign_intelligence_docs_storage_delete",
    { command: "DELETE", predicateLocation: "USING" },
  ],
]);

function runSql(sql) {
  const result = spawnSync("node", [psql, "-A", "-t", "-F", "\t", "-c", sql], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout || "");
    console.error(result.stderr || "");
    throw new Error(`psql failed (exit ${result.status})`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function normalize(expression) {
  return expression.toLowerCase().replace(/\s+/g, "");
}

function parsePolicies(output) {
  const policies = new Map();
  for (const line of output.split(/\r?\n/)) {
    const [name, command, roles, usingExpression, withCheckExpression] = line.split("\t");
    if (!expectedPolicies.has(name)) continue;
    policies.set(name, {
      command,
      roles,
      usingExpression: usingExpression ?? "",
      withCheckExpression: withCheckExpression ?? "",
    });
  }
  return policies;
}

const output = runSql(`
SELECT
  p.polname,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'd' THEN 'DELETE'
    ELSE p.polcmd::text
  END AS command,
  COALESCE(
    array_to_string(
      ARRAY(
        SELECT r.rolname
        FROM pg_roles AS r
        WHERE r.oid = ANY(p.polroles)
        ORDER BY r.rolname
      ),
      ','
    ),
    ''
  ) AS roles,
  COALESCE(pg_get_expr(p.polqual, p.polrelid), '') AS using_expression,
  COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') AS with_check_expression
FROM pg_policy AS p
JOIN pg_class AS c ON c.oid = p.polrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage'
  AND c.relname = 'objects'
  AND p.polname IN (
    'campaign_intelligence_docs_storage_select',
    'campaign_intelligence_docs_storage_insert',
    'campaign_intelligence_docs_storage_delete'
  )
ORDER BY p.polname;
`);

const policies = parsePolicies(output);
const failures = [];

for (const [name, expected] of expectedPolicies) {
  const policy = policies.get(name);
  if (!policy) {
    failures.push(`${name}: missing`);
    console.error(`FAIL  ${name}: policy is missing`);
    continue;
  }

  const predicate =
    expected.predicateLocation === "USING"
      ? policy.usingExpression
      : policy.withCheckExpression;
  const otherPredicate =
    expected.predicateLocation === "USING"
      ? policy.withCheckExpression
      : policy.usingExpression;
  const problems = [];

  if (policy.command !== expected.command) {
    problems.push(`command is ${policy.command || "empty"}, expected ${expected.command}`);
  }
  if (policy.roles !== "authenticated") {
    problems.push(`role is ${policy.roles || "empty"}, expected authenticated`);
  }
  if (normalize(predicate) !== ownershipPredicate) {
    problems.push(
      `${expected.predicateLocation} must be bucket_id='${bucketId}' with auth.uid() top-level-folder ownership`
    );
  }
  if (otherPredicate.trim()) {
    problems.push(
      `${expected.predicateLocation === "USING" ? "WITH CHECK" : "USING"} must be empty`
    );
  }

  if (problems.length) {
    failures.push(`${name}: ${problems.join("; ")}`);
    console.error(`FAIL  ${name}: ${problems.join("; ")}`);
  } else {
    console.log(
      `PASS  ${name}: ${expected.command} TO authenticated with ${expected.predicateLocation} ownership predicate`
    );
  }
}

console.log("\n--- Production Campaign Intelligence Storage policy verification ---");
console.log(`Passed: ${expectedPolicies.size - failures.length}/${expectedPolicies.size}`);
if (failures.length) {
  console.error("FAILED:", failures.join(" | "));
  process.exit(1);
}
console.log("verify-campaign-intelligence-storage-policies-production.mjs: ok");
