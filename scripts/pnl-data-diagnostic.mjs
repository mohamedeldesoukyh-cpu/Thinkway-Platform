import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key);

const ACTUAL = ["active", "paused", "completed"];

const { data: headers, error: hErr } = await sb
  .from("campaign_headers")
  .select("id, status, start_date, name")
  .limit(200);

const { data: lines, error: lErr } = await sb
  .from("campaign_lines")
  .select("id, campaign_header_id, status, revenue, cost, profit, revenue_base")
  .limit(500);

console.log("header error:", hErr?.message ?? "none");
console.log("lines error:", lErr?.message ?? "none");

const statusCounts = {};
for (const h of headers ?? []) {
  statusCounts[h.status] = (statusCounts[h.status] ?? 0) + 1;
}
console.log("header status counts:", statusCounts);
console.log("headers with start_date:", (headers ?? []).filter((h) => h.start_date).length);
console.log(
  "actual-status headers:",
  (headers ?? []).filter((h) => ACTUAL.includes(h.status)).length
);

const headerMap = new Map((headers ?? []).map((h) => [h.id, h]));
let matched = 0;
let withRevenue = 0;
for (const line of lines ?? []) {
  const h = headerMap.get(line.campaign_header_id);
  if (!h || !ACTUAL.includes(h.status)) continue;
  matched++;
  if (Number(line.revenue) > 0 || Number(line.revenue_base) > 0) withRevenue++;
}

console.log("lines matching actual headers:", matched);
console.log("lines with revenue > 0:", withRevenue);
console.log(
  "sample headers:",
  (headers ?? []).slice(0, 8).map((h) => ({ name: h.name, status: h.status, start: h.start_date }))
);
