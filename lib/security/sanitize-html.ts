import sanitizeHtml from "sanitize-html";

/**
 * Shared HTML sanitizer for all stored / rendered rich HTML (P2 XSS).
 * Strip scripts, event handlers, and dangerous URLs. Allow a conservative
 * formatting subset suitable for IO terms and email previews.
 */
const RICH_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "b",
    "blockquote",
    "br",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "i",
    "li",
    "ol",
    "p",
    "span",
    "strong",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    span: ["class"],
    p: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

const SVG_ICON_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "svg",
    "path",
    "circle",
    "rect",
    "defs",
    "linearGradient",
    "stop",
  ],
  allowedAttributes: {
    svg: ["width", "height", "viewBox", "aria-hidden", "xmlns"],
    path: ["fill", "d", "stroke", "stroke-width"],
    circle: ["cx", "cy", "r", "fill", "stroke", "stroke-width"],
    rect: ["x", "y", "width", "height", "rx", "fill"],
    linearGradient: ["id", "x1", "y1", "x2", "y2"],
    stop: ["offset", "stop-color"],
  },
  allowProtocolRelative: false,
};

/** Sanitize user/DB-controlled rich HTML before persistence or render. */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  if (dirty == null) return "";
  const input = String(dirty);
  if (!input.trim()) return "";
  return sanitizeHtml(input, RICH_HTML_OPTIONS).trim();
}

/** Sanitize trusted-but-parameterized inline SVG icons. */
export function sanitizeSvgIconHtml(dirty: string | null | undefined): string {
  if (dirty == null) return "";
  const input = String(dirty);
  if (!input.trim()) return "";
  return sanitizeHtml(input, SVG_ICON_OPTIONS).trim();
}
