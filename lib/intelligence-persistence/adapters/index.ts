import { apifyAdapter } from "./apify-adapter";
import type { ProviderAdapter } from "./types";
import type { IplProvider } from "../types";

const ADAPTERS: Record<IplProvider, ProviderAdapter | undefined> = {
  apify: apifyAdapter,
  modash: undefined,
  hypeauditor: undefined,
  creatoriq: undefined,
  open_graph: undefined,
};

export function getProviderAdapter(provider: IplProvider): ProviderAdapter | null {
  return ADAPTERS[provider] ?? null;
}

export { apifyAdapter };
export type { ProviderAdapter };
