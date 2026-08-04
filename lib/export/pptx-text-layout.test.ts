import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chunkPptxWrappedText,
  estimatePptxWrappedTextHeight,
} from "./pptx-text-layout";

describe("pptx-text-layout", () => {
  it("estimates taller boxes for long wrapped text", () => {
    const shortH = estimatePptxWrappedTextHeight({
      text: "Short note",
      widthInches: 10,
      fontSizePt: 10,
    });
    const longH = estimatePptxWrappedTextHeight({
      text: "Long commercial note. ".repeat(40),
      widthInches: 10,
      fontSizePt: 10,
    });
    assert.ok(longH > shortH);
    assert.ok(longH > 0.5);
  });

  it("chunks long notes so each piece fits a max height", () => {
    const text = Array.from({ length: 24 }, (_, i) => `Paragraph ${i + 1}: detailed creator rationale and commercial notes.`).join(
      "\n"
    );
    const chunks = chunkPptxWrappedText(text, 10, 11, 1.2);
    assert.ok(chunks.length >= 2);
    for (const chunk of chunks) {
      const h = estimatePptxWrappedTextHeight({
        text: chunk,
        widthInches: 10,
        fontSizePt: 11,
      });
      assert.ok(h <= 1.35);
    }
  });
});
