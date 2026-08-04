/**
 * Adaptive PPTX text sizing helpers — measure before placing so notes /
 * descriptions wrap fully without clipping into fixed one-line boxes.
 */

export type PptxTextMeasureInput = {
  text: string;
  widthInches: number;
  fontSizePt: number;
  /** Approx characters per inch at 11pt Arial; tuned for Calibri/Arial body. */
  charsPerInchAt11pt?: number;
  lineHeightInches?: number;
  minHeightInches?: number;
  maxHeightInches?: number;
  paddingLines?: number;
};

/**
 * Estimate wrapped text height in inches for pptxgenjs text boxes.
 * Conservative: prefers slightly taller boxes over clipped text.
 */
export function estimatePptxWrappedTextHeight(input: PptxTextMeasureInput): number {
  const text = input.text?.trim() ?? "";
  if (!text) return input.minHeightInches ?? 0;

  const fontSize = Math.max(6, input.fontSizePt);
  const charsPerInchAt11 = input.charsPerInchAt11pt ?? 11.5;
  const charsPerInch = charsPerInchAt11 * (11 / fontSize);
  const width = Math.max(0.5, input.widthInches);
  const charsPerLine = Math.max(8, Math.floor(width * charsPerInch));

  // Count hard newlines + soft wrap.
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  let lines = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().length === 0 ? [""] : paragraph.split(/\s+/);
    let current = 0;
    for (const word of words) {
      const len = word.length + (current > 0 ? 1 : 0);
      if (current + len > charsPerLine && current > 0) {
        lines += 1;
        current = word.length;
      } else {
        current += len;
      }
    }
    lines += 1;
  }

  lines += input.paddingLines ?? 0;
  const lineH = input.lineHeightInches ?? Math.max(0.16, fontSize / 72 + 0.04);
  const height = lines * lineH;
  const minH = input.minHeightInches ?? lineH;
  const maxH = input.maxHeightInches ?? Number.POSITIVE_INFINITY;
  return Math.min(maxH, Math.max(minH, height));
}

/**
 * Split text into page-sized chunks that fit within maxHeightInches.
 * Used when a description must continue cleanly on the next slide.
 */
export function chunkPptxWrappedText(
  text: string,
  widthInches: number,
  fontSizePt: number,
  maxHeightInches: number
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.replace(/\r\n/g, "\n").split("\n");
  const chunks: string[] = [];
  let current = "";

  const fits = (candidate: string) =>
    estimatePptxWrappedTextHeight({
      text: candidate,
      widthInches,
      fontSizePt,
    }) <= maxHeightInches;

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n${paragraph}` : paragraph;
    if (!current || fits(next)) {
      current = next;
      continue;
    }

    // Paragraph alone may exceed — split by words.
    const words = paragraph.split(/\s+/);
    let lineBuf = current;
    for (const word of words) {
      const trial = lineBuf ? `${lineBuf} ${word}` : word;
      if (fits(trial)) {
        lineBuf = trial;
      } else {
        if (lineBuf.trim()) chunks.push(lineBuf.trim());
        lineBuf = word;
        // Extremely long single word — force keep.
        if (!fits(lineBuf)) {
          chunks.push(lineBuf);
          lineBuf = "";
        }
      }
    }
    current = lineBuf;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [trimmed];
}
