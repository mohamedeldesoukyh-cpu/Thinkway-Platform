import JSZip from "jszip";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableRow(cells: string[]): string {
  const tcs = cells
    .map(
      (cell) =>
        `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`
    )
    .join("");
  return `<w:tr>${tcs}</w:tr>`;
}

function paragraph(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/** Build a minimal DOCX with L'Oréal Premium Skincare table rows (real OOXML bytes). */
export async function buildLorealPremiumSkincareDocx(): Promise<Buffer> {
  const rows = [
    ["Client / Brand Name", "L'Oréal Paris"],
    ["Market", "Egypt"],
    ["Campaign Name", "Vitamin C Serum Launch"],
    ["Campaign Country", "Egypt"],
    ["Campaign Duration", "5 weeks"],
    ["Campaign Objectives", "Engagement, UGC, Brand awareness"],
    ["Social Platforms", "Instagram, TikTok"],
    [
      "Creator Type Preferences",
      "Beauty, skincare specialists, micro-influencers, 20k-500k followers",
    ],
    ["Audience Preferences", "Women 25–40 interested in premium skincare"],
    ["Content Keywords", "vitamin c, serum, brightening, anti-aging"],
    ["Deliverables", "Reels, Stories, UGC posts"],
    ["Budget", "EUR 600,000"],
    ["KPIs", "Engagement rate 3%, Reach 2M"],
  ];

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraph("L'Oréal Premium Skincare Campaign Brief")}
    <w:tbl>
      <w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>
      ${rows.map((row) => tableRow(row)).join("")}
    </w:tbl>
    <w:sectPr/>
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

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rels);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", documentRels);

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}
