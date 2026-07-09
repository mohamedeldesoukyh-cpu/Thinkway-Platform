/** Block types preserved from document structure (not flattened). */
export type StructuredBriefHeading = {
  type: "heading";
  level: number;
  text: string;
};

export type StructuredBriefParagraph = {
  type: "paragraph";
  text: string;
};

export type StructuredBriefList = {
  type: "list";
  ordered: boolean;
  items: string[];
};

export type StructuredBriefTable = {
  type: "table";
  /** Each row is an array of cell values — never concatenated across cells. */
  rows: string[][];
};

export type StructuredBriefBlock =
  | StructuredBriefHeading
  | StructuredBriefParagraph
  | StructuredBriefList
  | StructuredBriefTable;

export type StructuredBriefSection = {
  title?: string;
  blocks: StructuredBriefBlock[];
};

/** How the structured parser obtained document blocks (inspection / debug). */
export type StructuredBriefParserMode =
  | "docx_ooxml_tables"
  | "docx_mammoth_html"
  | "docx_mammoth_raw_repair"
  | "docx_ooxml_empty"
  | "pdf_text"
  | "pptx_xml"
  | "plain_text";

export type StructuredBriefDocument = {
  title?: string;
  sections: StructuredBriefSection[];
  /** Source format hint for debugging. */
  sourceFormat?: "docx" | "pdf" | "pptx" | "txt" | "rtf" | "doc";
  /** Parser path used — persisted for Pipeline Inspector. */
  parserMode?: StructuredBriefParserMode;
};

export type StructuredBriefParseResult = {
  document: StructuredBriefDocument;
  /** LLM-friendly serialized text derived from structured blocks. */
  llmText: string;
  /** Flat fallback for storage preview only. */
  plainText: string;
};
