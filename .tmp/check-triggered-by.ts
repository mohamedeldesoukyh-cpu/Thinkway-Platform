import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env" });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data } = await s
  .from("publication_metric_sync_logs")
  .select("triggered_by, provider, status, message, created_at")
  .eq("publication_id", "92a881b8-a272-4e16-a7e7-6475bb42c57e")
  .order("created_at", { ascending: false })
  .limit(4);
console.log(JSON.stringify(data, null, 2));
