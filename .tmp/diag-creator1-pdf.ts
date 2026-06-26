import { readFileSync, writeFileSync } from "node:fs";
import { extractPdfText } from "@/lib/discovery-import/parsers/pdf-text";
import { parseIndahashText, isIndahashText, parseIndahashSearchExport } from "@/lib/discovery-import/parsers/indahash";
import { parsePdfBuffer } from "@/lib/discovery-import/parsers";

async function main() {
  const path = "C:\\Users\\X13 Yoga G3\\Downloads\\Creator 1.pdf";
  const buffer = readFileSync(path);
  console.log("[diag] file bytes", buffer.length);

  const text = await extractPdfText(buffer);
  console.log("[diag] extracted text length", text.length);
  console.log("[diag] isIndahashText", isIndahashText(text));
  console.log("[diag] ----- first 3000 chars -----");
  console.log(text.slice(0, 3000));
  console.log("[diag] ----- end sample -----");

  writeFileSync(".tmp/import-debug.txt", text, "utf8");
  console.log("[diag] full text written to .tmp/import-debug.txt");

  const rows = parseIndahashText(text, "indaHash");
  console.log("[diag] parseIndahashText rows", rows.length);
  console.log(JSON.stringify(rows.slice(0, 5), null, 2));

  const full = await parsePdfBuffer(buffer, "indaHash");
  console.log("[diag] parsePdfBuffer parser", full.parser, "rows", full.rows.length);
  console.log("[diag] diagnostics", JSON.stringify(full.diagnostics));

  const searchRows = parseIndahashSearchExport(text, "indaHash");
  console.log("[diag] search-export rows", searchRows.length);
  console.table(
    searchRows.map((r) => ({
      username: r.username,
      followers: r.followers,
      er: r.engagement_rate,
      relevance: r.relevance_score,
      categories: r.categories.join(" | "),
    }))
  );
  const withInterests = searchRows.filter((r) => r.categories.length > 0).length;
  console.log(
    `[diag] creators with audience interests: ${withInterests}/${searchRows.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
