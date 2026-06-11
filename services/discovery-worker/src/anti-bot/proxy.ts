import { config } from "../config.js";

let proxyIndex = 0;

export function nextProxyUrl(): string | undefined {
  if (config.proxyUrls.length === 0) return undefined;
  const url = config.proxyUrls[proxyIndex % config.proxyUrls.length];
  proxyIndex += 1;
  return url;
}
