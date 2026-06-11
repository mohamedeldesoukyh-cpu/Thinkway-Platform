import { NextResponse } from "next/server";

export function createPdfDocumentResponse(
  pdfBuffer: Buffer,
  baseName: string,
  download: boolean
): NextResponse {
  const disposition = download ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${baseName}.pdf"`,
    },
  });
}
