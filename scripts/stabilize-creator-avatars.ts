#!/usr/bin/env node
import "@/lib/performance/script-env-preload";

import { stabilizeCreatorsByHandles } from "@/lib/creators/stabilize-creator-avatar";
import {
  createScriptSupabase,
  requireScriptEnvVars,
} from "@/lib/performance/script-env";

const defaultHandles = [
  "zeinaelfakahany",
  "mayanelsayed",
  "jana.hassan__",
  "rowanabadry__",
  "omneya_abdelmoneim",
];

async function main() {
  requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const supabase = createScriptSupabase();
  const args = process.argv.slice(2);
  const forceRefresh = args.includes("--force");
  const handles = args.filter((arg) => arg !== "--force");
  const targets = handles.length > 0 ? handles : defaultHandles;

  const results = await stabilizeCreatorsByHandles(supabase, targets, { forceRefresh });
  for (const result of results) {
    console.log(
      `@${result.handle}: ${result.ok ? "OK" : "FAIL"} ${result.url ?? result.reason ?? ""}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
