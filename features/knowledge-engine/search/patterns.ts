const TW_HEADER_RE = /\bTW-\d{4}-\d{4,}\b/i;
const TW_LINE_RE = /\bTW-\d{4}-\d{4,}-[A-Z]\b/i;
const VIO_RE = /\bVIO-\d{4}-\d+\b/i;
const INV_RE = /\bINV-\d{4}-\d+\b/i;
const PO_RE = /\bPO-\d{4}-\d+\b/i;
const QT_RE = /\bQT-\d{4}-\d+\b/i;
const HANDLE_RE = /@([a-zA-Z0-9._]{2,30})/g;
const HASHTAG_RE = /#([a-zA-Z0-9_\u0600-\u06FF]{2,40})/g;

const PLATFORM_ALIASES: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  insta: "instagram",
  tiktok: "tiktok",
  tt: "tiktok",
  youtube: "youtube",
  yt: "youtube",
};

const KNOWN_PLATFORMS = new Set(Object.values(PLATFORM_ALIASES));

export function extractTwDocumentNumbers(message: string): string[] {
  const found = new Set<string>();
  const patterns = [TW_LINE_RE, TW_HEADER_RE, VIO_RE, INV_RE, PO_RE, QT_RE];
  for (const re of patterns) {
    const globalRe = new RegExp(re.source, `${re.flags.includes("g") ? re.flags : `${re.flags}g`}`);
    for (const match of message.matchAll(globalRe)) {
      found.add(match[0].toUpperCase());
    }
  }
  return [...found];
}

export function extractHandles(message: string): string[] {
  const handles = new Set<string>();
  for (const match of message.matchAll(HANDLE_RE)) {
    handles.add(match[1].toLowerCase());
  }
  const bareHandle = message.match(/\b([a-z][a-z0-9_.]{2,29})\b/gi);
  if (bareHandle) {
    for (const token of bareHandle) {
      if (!/^(tw|vio|inv|po|qt)-/i.test(token) && token.length >= 4) {
        handles.add(token.replace(/^@+/, "").toLowerCase());
      }
    }
  }
  return [...handles].slice(0, 5);
}

export function extractHashtags(message: string): string[] {
  return [...message.matchAll(HASHTAG_RE)].map((m) => m[1].toLowerCase());
}

export function detectPlatform(message: string): string | undefined {
  const lower = message.toLowerCase();
  for (const [alias, platform] of Object.entries(PLATFORM_ALIASES)) {
    const re = new RegExp(`\\b${alias}\\b`, "i");
    if (re.test(lower)) return platform;
  }
  return undefined;
}

export function isKnownPlatform(value: string): boolean {
  return KNOWN_PLATFORMS.has(value.toLowerCase());
}

export function extractQuotedPhrases(message: string): string[] {
  const phrases: string[] = [];
  for (const match of message.matchAll(/"([^"]{2,80})"|'([^']{2,80})'/g)) {
    phrases.push((match[1] ?? match[2]).trim());
  }
  return phrases;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "this", "that", "my", "our", "your", "for", "with",
  "and", "or", "in", "on", "at", "to", "of", "is", "are", "was", "were",
  "campaign", "campaigns", "client", "brand", "creator", "creators",
  "influencer", "influencers", "shortlist", "invoice", "analyze", "analysis",
  "find", "create", "build", "generate", "help", "please", "show", "list",
  "get", "about", "from", "into", "line", "purchase", "order", "quotation",
]);

export function extractEntityCandidates(message: string): string[] {
  const candidates = new Set<string>();

  for (const doc of extractTwDocumentNumbers(message)) {
    candidates.add(doc);
  }

  for (const phrase of extractQuotedPhrases(message)) {
    candidates.add(phrase);
  }

  const cleaned = message
    .replace(HANDLE_RE, " ")
    .replace(HASHTAG_RE, " ")
    .replace(TW_LINE_RE, " ")
    .replace(TW_HEADER_RE, " ")
    .replace(VIO_RE, " ")
    .replace(INV_RE, " ")
    .replace(PO_RE, " ")
    .replace(QT_RE, " ");

  const segments = cleaned.split(/[,;]|(?:\band\b|\bfor\b|\babout\b|\bon\b)/i);
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed.length >= 3 && trimmed.length <= 80) {
      candidates.add(trimmed);
    }
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i].replace(/[^\w\u0600-\u06FF'-]/g, "");
    if (token.length < 3 || STOP_WORDS.has(token.toLowerCase())) continue;

    candidates.add(token);

    if (i + 1 < tokens.length) {
      const next = tokens[i + 1].replace(/[^\w\u0600-\u06FF'-]/g, "");
      if (next.length >= 2 && !STOP_WORDS.has(next.toLowerCase())) {
        candidates.add(`${token} ${next}`);
        if (i + 2 < tokens.length) {
          const third = tokens[i + 2].replace(/[^\w\u0600-\u06FF'-]/g, "");
          if (third.length >= 2 && !STOP_WORDS.has(third.toLowerCase())) {
            candidates.add(`${token} ${next} ${third}`);
          }
        }
      }
    }
  }

  return [...candidates]
    .filter((c) => c.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);
}

export function inferEntityTypeFromDocumentNumber(doc: string): EntityTypeHint {
  const upper = doc.toUpperCase();
  if (TW_LINE_RE.test(upper)) return "campaign_line";
  if (TW_HEADER_RE.test(upper)) return "campaign";
  if (INV_RE.test(upper)) return "invoice";
  if (PO_RE.test(upper)) return "purchase_order";
  if (VIO_RE.test(upper)) return "purchase_order";
  if (QT_RE.test(upper)) return "quotation";
  return "document_number";
}

export type EntityTypeHint =
  | "campaign"
  | "campaign_line"
  | "invoice"
  | "purchase_order"
  | "quotation"
  | "document_number";
