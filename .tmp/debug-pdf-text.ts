import { buildTestPdf } from "../lib/discovery-import/parsers/pdf-test-fixtures";
import { parsePdfBuffer } from "../lib/discovery-import/parsers/index";
import { extractPdfText } from "../lib/discovery-import/parsers/pdf-text";

async function main() {
  const pageOne =
    "@page_one Instagram 1000 2.00% Jordan Fashion 70\nindaHash export";
  const pageTwo = "@page_two TikTok 2500 3.50% UAE Travel 85";
  const buffer = buildTestPdf([pageOne, pageTwo]);
  const text = await extractPdfText(buffer);
  console.log("TEXT:", JSON.stringify(text));
  const result = await parsePdfBuffer(buffer, "indaHash");
  console.log("RESULT:", result);
}

main().catch(console.error);
