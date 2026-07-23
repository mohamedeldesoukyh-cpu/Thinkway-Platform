import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderQuotationPlatformIconsHtml(
  platforms: string[],
  className = "quotation-platform-icons"
): string {
  const uniquePlatforms = [...new Set(platforms.map((platform) => platform.trim()).filter(Boolean))];
  if (!uniquePlatforms.length) return "";

  const badges = uniquePlatforms
    .map((platform) => {
      const iconDataUri = getReportPlatformIconDataUri(platform);
      if (iconDataUri) {
        const title = getReportPlatformIconTitle(platform);
        return `<img class="quotation-platform-icon" src="${iconDataUri}" alt="${esc(title)}" title="${esc(title)}" />`;
      }

      const label = getReportPlatformIconTitle(platform).slice(0, 2).toUpperCase();
      return `<span class="quotation-platform-icon-fallback" title="${esc(getReportPlatformIconTitle(platform))}">${esc(label)}</span>`;
    })
    .join("");

  return `<span class="${className}">${badges}</span>`;
}
