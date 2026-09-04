/**
 * Measure similar-creators rail scores for one live creator (Dev).
 * Reports the 8 similarity_score values — not just the LIMIT.
 */
import { createClient } from "@supabase/supabase-js";

import { findSimilarCreators } from "@/lib/creators/similar-creators";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env");
    process.exit(1);
  }

  const influencerId = process.argv[2] || "b1d178d3-f882-4ec7-b45d-888e85ab921e"; // Karim
  const unifiedId = `inf:${influencerId}`;

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const creator = await getUnifiedCreatorById(sb, unifiedId);
  if (!creator) {
    console.error("Creator not found", unifiedId);
    process.exit(1);
  }

  const similar = await findSimilarCreators(sb, creator, 8);
  const scores = similar.map((s) => s.similarity_score);
  const distinct = [...new Set(scores)].sort((a, b) => b - a);

  console.log(
    JSON.stringify(
      {
        host: new URL(url).hostname,
        seed: { unifiedId, name: creator.display_name },
        count: similar.length,
        scores,
        distinctScores: distinct,
        distinctCount: distinct.length,
        rows: similar.map((s) => ({
          name: s.display_name,
          handle: s.platforms[0]?.handle ?? null,
          similarity_score: s.similarity_score,
        })),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
