import QRCode from "qrcode";

/** QR code image URL for report embed (legacy remote host — prefer data URI). */
export function buildQrCodeImageUrl(data: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=0`;
}

/**
 * Self-contained PNG data URI so preview iframes and PDF renders do not depend on
 * external QR hosts (which often fail inside srcDoc / Puppeteer).
 */
export async function buildQrCodeDataUri(
  data: string,
  size = 120
): Promise<string | null> {
  const trimmed = data.trim();
  if (!trimmed) return null;
  try {
    return await QRCode.toDataURL(trimmed, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: {
        dark: "#020B26",
        light: "#FFFFFF",
      },
    });
  } catch {
    return null;
  }
}
