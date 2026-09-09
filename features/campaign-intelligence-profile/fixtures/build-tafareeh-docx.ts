import JSZip from "jszip";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function heading(text: string, level = 1): string {
  return `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function paragraph(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Build a minimal Tafareeh Tea DOCX with real OOXML bytes — a heading-style
 * narrative brief, which is the shape the platform actually receives (the
 * L'Oréal fixture covers the key/value table shape).
 *
 * Deliberately a real ZIP container so tests can prove that reading it as
 * plain text yields `PK…[Content_Types].xml` rather than readable content.
 */
export async function buildTafareehTeaDocx(): Promise<Buffer> {
  const body = [
    paragraph("Tafareeh Tea Campaign Brief"),
    heading("Campaign Objective"),
    paragraph(
      "Build awareness for Tafareeh Tea and encourage people to try and buy the product."
    ),
    heading("Market"),
    paragraph("Egypt"),
    heading("Duration"),
    paragraph("2 weeks"),
    heading("Target Audience"),
    paragraph("Egyptian tea drinkers, mainly young adults and families."),
    heading("Key Message"),
    paragraph("Rich, strong tea integrated naturally into everyday Egyptian life."),
    heading("Creator Deliverables"),
    paragraph("1 Instagram Reel and 1 Instagram Story, mirrored to TikTok."),
    heading("Call to Action"),
    paragraph("Try Tafareeh Tea."),
    heading("Campaign Goal"),
    paragraph("Awareness -> Interest -> Trial"),
    heading("Tone"),
    paragraph("Natural, relatable, positive, Egyptian, not overly scripted."),
  ].join("\n");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.folder("_rels")!.file(".rels", rels);
  zip.folder("word")!.file("document.xml", documentXml);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
