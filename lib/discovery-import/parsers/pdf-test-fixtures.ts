/**
 * Build a minimal valid PDF with optional multi-page plain text content.
 * Used by discovery-import PDF regression tests (no external fixture files).
 */
export function buildTestPdf(pages: string[]): Buffer {
  const escapePdfText = (value: string) =>
    value
      .replace(/\r?\n/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");

  const buildTextStream = (pageText: string): string => {
    const lines = pageText.replace(/\r\n/g, "\n").split("\n");
    const streamParts = ["BT", "/F1 10 Tf", "72 720 Td"];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      if (lineIndex > 0) {
        streamParts.push("T*");
      }

      const line = lines[lineIndex] ?? "";
      for (let offset = 0; offset < line.length; offset += 90) {
        const chunk = line.slice(offset, offset + 90);
        if (!chunk) continue;
        if (offset > 0) {
          streamParts.push("T*");
        }
        streamParts.push(`(${escapePdfText(chunk)}) Tj`);
      }
    }

    streamParts.push("ET");
    return streamParts.join(" ");
  };

  let nextId = 3;
  const pageSpecs = pages.map((pageText) => {
    const spec = {
      pageText,
      pageId: nextId++,
      contentId: nextId++,
    };
    return spec;
  });
  const fontId = nextId++;

  const pageObjects: string[] = [];
  const kids: string[] = [];

  for (const spec of pageSpecs) {
    kids.push(`${spec.pageId} 0 R`);
    const stream = buildTextStream(spec.pageText);
    pageObjects.push(
      `${spec.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${spec.contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`,
      `${spec.contentId} 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  const header = "%PDF-1.4\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    ...pageObjects,
    `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ];

  let body = header;
  const offsets: number[] = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += object;
  }

  const xrefOffset = Buffer.byteLength(body, "utf8");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, "utf8");
}

/** PDF with a valid header but truncated body (malformed). */
export function buildMalformedPdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog", "utf8");
}

/** Valid PDF with an empty page (no extractable creator text). */
export function buildEmptyPdf(): Buffer {
  return buildTestPdf([""]);
}
