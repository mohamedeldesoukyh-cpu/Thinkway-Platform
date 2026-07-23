/**
 * Platform brand colors and icons for Media Plan allocation bars.
 * Solid colors used where gradients are unsupported (PPTX); CSS gradients in HTML/React.
 */

export function normalizePlatformKey(platform: string): string {
  return platform.trim().toLowerCase().replace(/\s+/g, "");
}

/** CSS background for HTML / React bars — may be gradient. */
export function resolvePlatformBarBackground(platform: string, fallbackIndex = 0): string {
  const key = normalizePlatformKey(platform);
  if (key.includes("instagram")) {
    return "linear-gradient(90deg,#F58529 0%,#DD2A7B 45%,#8134AF 75%,#515BD4 100%)";
  }
  if (key.includes("tiktok")) return "#010101";
  if (key.includes("facebook")) return "#1877F2";
  if (key.includes("youtube")) return "#FF0000";
  if (key.includes("snapchat")) return "#FFFC00";
  if (key.includes("twitter") || key === "x") return "#000000";
  if (key.includes("linkedin")) return "#0A66C2";
  if (key.includes("ugc")) return "#0C9D57";
  if (key.includes("pinterest")) return "#E60023";
  const fallbacks = ["#0057FF", "#7C3AED", "#0C9D57", "#3B82F6", "#EC4899"];
  return fallbacks[fallbackIndex % fallbacks.length]!;
}

/** Solid hex for PPTX and contexts that do not support gradients. */
export function resolvePlatformBarSolidColor(platform: string, fallbackIndex = 0): string {
  const key = normalizePlatformKey(platform);
  if (key.includes("instagram")) return "#DD2A7B";
  if (key.includes("tiktok")) return "#010101";
  if (key.includes("facebook")) return "#1877F2";
  if (key.includes("youtube")) return "#FF0000";
  if (key.includes("snapchat")) return "#FFFC00";
  if (key.includes("twitter") || key === "x") return "#000000";
  if (key.includes("linkedin")) return "#0A66C2";
  if (key.includes("ugc")) return "#0C9D57";
  if (key.includes("pinterest")) return "#E60023";
  const fallbacks = ["#0057FF", "#7C3AED", "#0C9D57", "#3B82F6", "#EC4899"];
  return fallbacks[fallbackIndex % fallbacks.length]!;
}

/** Inline SVG markup for HTML export (small icon before platform name). */
export function platformIconSvgHtml(platform: string, size = 14): string {
  const key = normalizePlatformKey(platform);
  const s = size;
  if (key.includes("instagram")) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig)"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.2" fill="#fff"/></svg>`;
  }
  if (key.includes("tiktok")) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#010101"/><path fill="#25F4EE" d="M16.5 7.5v7.2a3.3 3.3 0 1 1-2.4-3.2V8.9a5.8 5.8 0 0 0 3.2 1.8V7.5h2.4z"/><path fill="#FE2C55" d="M14.1 11.5a3.3 3.3 0 1 0 2.4 3.2V7.5h2.4v3.2a5.8 5.8 0 0 1-4.8-4.2v5z"/></svg>`;
  }
  if (key.includes("facebook")) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#1877F2"/><path fill="#fff" d="M14.5 8h-2a1 1 0 0 0-1 1v2h3l-.4 3h-2.6v8h-3v-8H8v-3h2V9a4 4 0 0 1 4-4h2.5v3z"/></svg>`;
  }
  if (key.includes("youtube")) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#FF0000"/><path fill="#fff" d="M10 8.5v7l6-3.5-6-3.5z"/></svg>`;
  }
  if (key.includes("snapchat")) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#FFFC00"/><path fill="#000" d="M12 4c2.8 0 5 2 5 5.2 0 1.4-.5 2.6-1.3 3.5.8.3 1.5.9 1.9 1.7.5.9.4 2-.2 2.8-.6.8-1.6 1-2.5.6-.4 1.1-1.5 1.9-2.9 1.9s-2.5-.8-2.9-1.9c-.9.4-1.9.2-2.5-.6-.6-.8-.7-1.9-.2-2.8.4-.8 1.1-1.4 1.9-1.7-.8-.9-1.3-2.1-1.3-3.5C7 6 9.2 4 12 4z"/></svg>`;
  }
  if (key.includes("twitter") || key === "x") {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#000"/><path fill="#fff" d="M13.2 10.5L18.5 4h-1.3l-4.6 5.6L9.2 4H4l5.5 8.1L4 20h1.3l4.9-5.9 3.9 5.9H20l-6.8-9.4z"/></svg>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#6B7280"/></svg>`;
}
