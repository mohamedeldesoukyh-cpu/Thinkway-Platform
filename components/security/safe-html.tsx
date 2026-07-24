import { sanitizeRichHtml, sanitizeSvgIconHtml } from "@/lib/security/sanitize-html";

type SafeHtmlProps = {
  html: string | null | undefined;
  className?: string;
  as?: "div" | "span";
};

/**
 * Renders HTML only after shared sanitization. Use for any DB/user HTML.
 */
export function SafeHtml({ html, className, as = "div" }: SafeHtmlProps) {
  const clean = sanitizeRichHtml(html);
  if (!clean) return null;
  const Tag = as;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

type SafeSvgHtmlProps = {
  html: string | null | undefined;
  className?: string;
};

/** Inline SVG icons from trusted builders — still passed through SVG allowlist. */
export function SafeSvgHtml({ html, className }: SafeSvgHtmlProps) {
  const clean = sanitizeSvgIconHtml(html);
  if (!clean) return null;
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
