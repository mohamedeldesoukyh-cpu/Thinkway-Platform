import {
  anthropicProvider,
  geminiProvider,
  openAiProvider,
} from "./ai-providers";
import {
  bullMqProvider,
  nextJsProvider,
  realtimeProvider,
  redisProvider,
  storageProvider,
  supabaseProvider,
  vercelProvider,
} from "./infrastructure-providers";
import {
  apifyProvider,
  googleOAuthProvider,
  metaProvider,
  resendProvider,
  smtpProvider,
  tiktokProvider,
  youtubeProvider,
} from "./integration-providers";
import type { HealthProvider } from "./types";

const providers = new Map<string, HealthProvider>();

export function registerHealthProvider(provider: HealthProvider): void {
  providers.set(provider.id, provider);
}

export function unregisterHealthProvider(id: string): void {
  providers.delete(id);
}

export function getHealthProvider(id: string): HealthProvider | undefined {
  return providers.get(id);
}

export function listHealthProviders(): HealthProvider[] {
  return [...providers.values()];
}

export function resetHealthProviderRegistry(): void {
  providers.clear();
}

/** Default Thinkway platform adapters. */
export function registerDefaultHealthProviders(): void {
  const defaults: HealthProvider[] = [
    nextJsProvider,
    vercelProvider,
    supabaseProvider,
    redisProvider,
    bullMqProvider,
    storageProvider,
    realtimeProvider,
    openAiProvider,
    anthropicProvider,
    geminiProvider,
    apifyProvider,
    resendProvider,
    smtpProvider,
    googleOAuthProvider,
    metaProvider,
    tiktokProvider,
    youtubeProvider,
  ];
  for (const provider of defaults) {
    registerHealthProvider(provider);
  }
}

/** Registers defaults only when the registry is empty (idempotent). */
export function ensureDefaultHealthProviders(): void {
  if (providers.size > 0) return;
  registerDefaultHealthProviders();
}
