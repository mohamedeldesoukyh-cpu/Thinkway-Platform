/**
 * Render a Vendor IO HTML file locally (no Puppeteer).
 * Run: npx tsx scripts/preview-vendor-io-local.ts [vendor_io_id]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { loadVendorIoDocumentData } from "@/lib/io/vendor-io-document-data";
import { renderVendorIoHtml } from "@/lib/io/vendor-io-template-render";

config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const vendorIoId =
  process.argv[2]?.trim() || "337a5476-25b7-4437-ad4f-21d550dfebc3";

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const data = await loadVendorIoDocumentData(supabase, vendorIoId);
  const html = renderVendorIoHtml(data);
  const outDir = join(process.cwd(), "tmp");
  mkdirSync(outDir, { recursive: true });
  const fileName = `${data.documentNumber.replace(/\//g, "-")}.html`;
  const outPath = join(outDir, fileName);
  writeFileSync(outPath, html, "utf8");
  console.log(`Vendor IO rendered: ${data.documentNumber}`);
  console.log(`Open: file:///${outPath.replace(/\\/g, "/")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
