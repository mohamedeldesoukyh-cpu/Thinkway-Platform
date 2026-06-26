#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const pubIds = [
  "02e7e3eb-649c-426a-88e6-6c456dcf541a",
  "43b60c74-383f-4efc-a997-b1d4e5b4815c",
];

async function main() {
  const { data, error } = await supabase
    .from("publication_metric_sync_logs")
    .select("publication_id, provider, status, response_summary, created_at")
    .in("publication_id", pubIds)
    .eq("provider", "apify")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
