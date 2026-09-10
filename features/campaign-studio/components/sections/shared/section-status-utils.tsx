"use client";

import type { CampaignStudioSectionStatus } from "../../../types/campaign-studio";
import { stripInternalSearchMetadata } from "./format-utils";
import {
  parseSectionMarkdown,
  type SectionMarkdownSpan,
} from "../../../services/section-markdown";

export function shouldShowPendingPlaceholder(
  status: CampaignStudioSectionStatus,
  hasStructuredData: boolean
): boolean {
  if (hasStructuredData) return false;
  if (status === "complete" || status === "blocked") return false;
  return status === "pending" || status === "running";
}

function MarkdownSpans({ spans }: { spans: SectionMarkdownSpan[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold ? (
          <strong key={index} className="font-semibold text-foreground">
            {span.text}
          </strong>
        ) : span.italic ? (
          <em key={index}>{span.text}</em>
        ) : (
          <span key={index}>{span.text}</span>
        )
      )}
    </>
  );
}

/**
 * A section's formatter text, rendered.
 *
 * The formatters emit light markdown (bold labels, headings, bullets) and this
 * printed it verbatim, so the Content screen showed `**Duration:** 4 weeks`.
 * The content is unchanged — only its presentation. Line and paragraph breaks
 * are preserved exactly as before.
 */
export function SectionFallbackContent({ text }: { text: string }) {
  const cleaned = stripInternalSearchMetadata(text);
  if (!cleaned.trim()) return null;

  const blocks = parseSectionMarkdown(cleaned);

  return (
    <div className="min-w-0 space-y-2 break-words text-[13px] leading-relaxed text-foreground">
      {blocks.map((block, blockIndex) => (
        <div key={blockIndex} className="min-w-0 space-y-0.5">
          {block.lines.map((line, lineIndex) => {
            if (line.kind === "heading") {
              return (
                <p
                  key={lineIndex}
                  className="min-w-0 break-words font-semibold text-foreground"
                  style={{ fontSize: line.level <= 2 ? "14px" : "13px" }}
                >
                  <MarkdownSpans spans={line.spans} />
                </p>
              );
            }
            if (line.kind === "bullet") {
              return (
                <p
                  key={lineIndex}
                  className="min-w-0 break-words"
                  style={{ paddingLeft: `${12 + line.depth * 12}px` }}
                >
                  <span className="mr-1.5 text-muted-foreground">·</span>
                  <MarkdownSpans spans={line.spans} />
                </p>
              );
            }
            return (
              <p key={lineIndex} className="min-w-0 break-words">
                <MarkdownSpans spans={line.spans} />
              </p>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SectionPendingMessage({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground italic">{label}</p>;
}
