#!/usr/bin/env npx tsx
import { createClient } from "@supabase/supabase-js";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { tryApifyProvider } from "@/lib/performance/metrics-collector/providers/apify";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const amirIds = [
  "02e7e3eb-649c-426a-88e6-6c456dcf541a",
  "43b60c74-383f-4efc-a997-b1d4e5b4815c",
];

async function main() {
  const { data: pubs } = await supabase
    .from("campaign_publications")
    .select("id, content_url, reach, actual_reach, views, likes")
    .in("id", amirIds);

  console.log("PUBLICATIONS:", JSON.stringify(pubs, null, 2));

  const { data: logs, error: logErr } = await supabase
    .from("publication_metric_sync_logs")
    .select("publication_id, provider, status, response_summary, metrics_snapshot, created_at")
    .in("publication_id", amirIds)
    .order("created_at", { ascending: false })
    .limit(6);

  console.log("LOG_ERR:", logErr);
  console.log("LOGS:", JSON.stringify(logs, null, 2));

  const env = getMetricsCollectorEnv();
  const url = pubs?.[0]?.content_url;
  if (url && env.apifyToken) {
    const result = await tryApifyProvider({
      publication: { content_url: url },
      platform: "instagram",
      contentUrl: url,
      env,
    });
    console.log("APIFY_METRICS:", JSON.stringify(result.metrics, null, 2));
    console.log("APIFY_SUMMARY:", JSON.stringify(result.responseSummary, null, 2));
  }
}

main().catch(console.error);
