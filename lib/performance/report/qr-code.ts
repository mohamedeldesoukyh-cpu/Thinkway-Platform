/** QR code image URL for report embed (Puppeteer fetches at PDF render time). */
export function buildQrCodeImageUrl(data: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=0`;
}
