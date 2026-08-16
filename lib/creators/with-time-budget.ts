/**
 * Resolve `promise` within `budgetMs`, otherwise return `fallback`.
 * Rejections also return `fallback`. The original work is not cancelled —
 * callers use this to keep SSR / Server Actions off the Production digest path.
 */
export async function withTimeBudget<T>(
  promise: Promise<T>,
  budgetMs: number,
  fallback: T
): Promise<T> {
  if (budgetMs <= 0) return fallback;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), budgetMs);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
