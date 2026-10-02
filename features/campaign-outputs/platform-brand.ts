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
export function platformIconSvgHtml(platform: string, size = 14, imageUri?: string | null): string {
  const key = normalizePlatformKey(platform);
  const s = size;
  const supplied = ["instagram", "tiktok", "facebook", "youtube", "linkedin"].find(name => key.includes(name));
  if (supplied) return `<img src="${imageUri ?? `/platform-icons/${supplied}.png`}" width="${s}" height="${s}" alt="" style="object-fit:contain;border:0;border-radius:0;background:transparent;box-shadow:none" />`;
  if (key.includes("snapchat")) {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#FFFC00"/><path fill="#000" d="M12 4c2.8 0 5 2 5 5.2 0 1.4-.5 2.6-1.3 3.5.8.3 1.5.9 1.9 1.7.5.9.4 2-.2 2.8-.6.8-1.6 1-2.5.6-.4 1.1-1.5 1.9-2.9 1.9s-2.5-.8-2.9-1.9c-.9.4-1.9.2-2.5-.6-.6-.8-.7-1.9-.2-2.8.4-.8 1.1-1.4 1.9-1.7-.8-.9-1.3-2.1-1.3-3.5C7 6 9.2 4 12 4z"/></svg>`;
  }
  if (key.includes("twitter") || key === "x") {
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#000"/><path fill="#fff" d="M13.2 10.5L18.5 4h-1.3l-4.6 5.6L9.2 4H4l5.5 8.1L4 20h1.3l4.9-5.9 3.9 5.9H20l-6.8-9.4z"/></svg>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#6B7280"/></svg>`;
}
