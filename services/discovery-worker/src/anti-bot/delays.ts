import { config } from "../config.js";

export async function randomizedDelay(): Promise<void> {
  const span = config.maxDelayMs - config.minDelayMs;
  const ms = config.minDelayMs + Math.floor(Math.random() * Math.max(span, 1));
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseMs = 1500
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const wait = baseMs * (i + 1) + Math.floor(Math.random() * 500);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}
