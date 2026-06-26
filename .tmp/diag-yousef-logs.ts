#!/usr/bin/env npx tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const yousefIds = [
  "db27068e-8ffb-46e7-b558-13207ac9fbbb",
  "b85c2d31-e696-4d46-8b04-fa87bdb8d9e7",
];

async function main() {
  const { data: logs } = await supabase
    .from("publication_metric_sync_logs")
    .select("publication_id, provider, status, response_summary, metrics_snapshot, created_at")
    .in("publication_id", yousefIds)
    .order("created_at", { ascending: false })
    .limit(8);

  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error);
