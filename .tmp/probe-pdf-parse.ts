import { PDFParse } from "pdf-parse";

async function main() {
  const m = await import("pdf-parse");
  console.log("keys:", Object.keys(m));
  console.log("default:", typeof m.default);
  console.log("PDFParse:", typeof m.PDFParse);

  try {
    const pdfParse = (m as { default?: unknown }).default;
    await (pdfParse as (b: Buffer) => Promise<unknown>)(Buffer.from("test"));
  } catch (e) {
    console.log("default call error:", e instanceof Error ? e.message : e);
  }

  try {
    const parser = new PDFParse({ data: Buffer.from("%PDF-1.4\n") });
    const result = await parser.getText();
    await parser.destroy();
    console.log("PDFParse text length:", result.text.length);
  } catch (e) {
    console.log("PDFParse class error:", e instanceof Error ? e.message : e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
