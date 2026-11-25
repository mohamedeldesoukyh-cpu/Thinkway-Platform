type MosaicTile = { src: string; kind: "portrait" | "logo" };

/** Keep each photo once; shuffle decoration consistently for preview and PDF. */
export function quotationPhotoMosaic(portraits: string[], logos: string[], seed: string): MosaicTile[] {
  const tiles: MosaicTile[] = [...new Set(portraits.filter(Boolean))].map(src => ({ src, kind: "portrait" }));
  const brandImages = logos.filter(Boolean);
  const count = Math.min(4, Math.max(2, Math.ceil(tiles.length / 6)));
  if (brandImages.length) {
    for (let i = 0; i < count; i++) tiles.push({ src: brandImages[i % brandImages.length], kind: "logo" });
  }
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  for (let i = tiles.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((state / 4294967296) * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}
