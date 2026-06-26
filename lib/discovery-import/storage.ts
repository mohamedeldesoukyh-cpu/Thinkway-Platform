import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const CREATOR_IMPORT_BUCKET = "creator-imports";

export async function downloadCreatorImportFile(params: {
  supabase: SupabaseClient<Database>;
  storagePath: string;
}): Promise<Buffer> {
  const { data, error } = await params.supabase.storage
    .from(CREATOR_IMPORT_BUCKET)
    .download(params.storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Could not download import file.");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
