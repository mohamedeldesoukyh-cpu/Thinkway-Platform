/** Development-only logging — no-op in production builds. */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.debug(...args);
  }
}
