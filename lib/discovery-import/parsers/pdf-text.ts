import { PDFParse } from "pdf-parse";

/** Extract plain text from a PDF buffer using pdf-parse v2 (`PDFParse` class API). */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}
