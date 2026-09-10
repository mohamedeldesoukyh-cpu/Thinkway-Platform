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
 * One paragraph whose lines are separated by soft breaks (Shift+Enter) — how a
 * real Word brief writes a stacked block of labelled values. Mammoth converts
 * `<w:br/>` to `<br />`.
 */
export function paragraphWithSoftBreaks(lines: string[]): string {
  const runs = lines
    .map(
      (line, index) =>
        `${index > 0 ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`
    )
    .join("");
  return `<w:p>${runs}</w:p>`;
}

/** A numbered/bulleted paragraph — the shape a real Word list produces. */
function listItem(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Kérastase Egypt influencer brief — real OOXML bytes.
 *
 * The shape that matters: no tables at all, and the campaign's audience,
 * deliverables, KPIs, key message and CTA stated as HEADING + LIST. That is the
 * common agency brief format, and the structured field mapper used to read
 * table cells only, so those five fields were parsed and then discarded.
 *
 * Content is copied from the brief the platform actually received, including
 * the accented brand name (which the budget parser mis-read as a magnitude
 * suffix) and the "beauty, haircare, lifestyle and fashion creators" line
 * (which classified the client as Retail & Sportswear).
 */
export async function buildKerastaseEgyptDocx(): Promise<Buffer> {
  const body = [
    paragraph("Kérastase Egypt"),
    paragraph("Influencer Campaign Brief"),

    heading("1. Campaign Overview"),
    paragraph("Brand: Kérastase"),
    paragraph("Market: Egypt"),
    paragraph("Campaign Duration: 4 Weeks"),
    paragraph("Total Influencer Budget: EGP 3,000,000"),
    paragraph(
      "Kérastase is looking to partner with a carefully selected group of Egyptian influencers and content creators to drive product consideration, trial, and purchase intent among consumers interested in premium haircare."
    ),

    heading("2. Campaign Objective"),
    paragraph("Primary Objective: Drive Consideration & Conversion"),
    paragraph("The campaign aims to:"),
    listItem("Encourage consumers to consider Kérastase when choosing premium haircare products."),
    listItem("Demonstrate the product benefits through authentic creator experiences."),
    listItem("Drive qualified traffic and purchase intent toward Kérastase products."),

    heading("3. Target Audience"),
    paragraph("Primary Audience:"),
    paragraph("Women aged 20–40 in Egypt who:"),
    listItem("Are interested in premium beauty and haircare."),
    listItem("Regularly use haircare products."),
    listItem("Experience concerns such as hair damage, dryness, frizz, hair fall or lack of shine."),
    listItem("Follow beauty, haircare, lifestyle and fashion creators."),
    listItem("Have purchasing power for premium beauty products."),
    paragraph("Priority Cities: Cairo & Giza, Alexandria, and other major Egyptian cities."),

    heading("4. Influencer Profile"),
    paragraph("We are looking for creators who have:"),
    listItem("Strong credibility in beauty, haircare, lifestyle and fashion."),
    listItem("High-quality and visually appealing content."),
    listItem("An audience predominantly located in Egypt."),

    heading("7. Preferred Creator Mix"),
    paragraph("Preferred Creator Mix: Macro / Mid / Micro"),
    paragraph(
      "The final allocation across these tiers can be recommended based on budget and reach."
    ),

    heading("5. Key Campaign Message"),
    paragraph("“Professional-level haircare designed around your hair needs.”"),
    paragraph(
      "Creators should communicate how Kérastase can become part of their personal haircare routine and clearly demonstrate the product’s benefits."
    ),

    heading("6. Content Deliverables"),
    paragraph("Each selected creator should produce content appropriate to their audience and platform."),
    paragraph("Suggested deliverables:"),
    listItem("1 Instagram Reel / TikTok video"),
    listItem("3–5 Instagram Stories"),
    listItem("Product integration within the creator’s genuine haircare routine"),
    listItem("Clear product demonstration / usage"),
    listItem("Call-to-action encouraging consumers to discover or purchase the product"),

    heading("8. Call To Action"),
    paragraph("Every piece of content should include a clear CTA, such as:"),
    listItem("Discover your Kérastase routine."),
    listItem("Find the right Kérastase solution for your hair."),
    listItem("Shop Kérastase."),

    heading("9. Campaign Duration"),
    paragraph("4 Weeks"),

    heading("10. Budget"),
    paragraph("Total Campaign Budget: EGP 3,000,000"),
    paragraph("The budget should cover influencer fees and agreed campaign deliverables."),

    heading("11. KPIs"),
    heading("Primary KPIs", 2),
    listItem("Engagement Rate"),
    listItem("Link Clicks / Qualified Traffic"),
    listItem("Conversions / Purchases"),
    listItem("Cost Per Engagement"),
    listItem("Conversion Rate"),
    heading("Secondary KPIs", 2),
    listItem("Video Views"),
    listItem("Saves"),
    listItem("Shares"),

    heading("13. Brand Safety"),
    listItem("Maintain a premium and professional image."),
    listItem("Follow Kérastase/L’Oréal brand guidelines."),
  ].join("\n");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
  </w:body>
</w:document>`;

  // Real bullet numbering, so the document parses as LIST blocks rather than
  // loose paragraphs — that distinction is the whole point of this fixture.
  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
</w:numbering>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.folder("_rels")!.file(".rels", rels);
  const word = zip.folder("word")!;
  word.file("document.xml", documentXml);
  word.file("numbering.xml", numberingXml);
  word.folder("_rels")!.file("document.xml.rels", documentRels);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
