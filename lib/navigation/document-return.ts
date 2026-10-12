/** Keep document Back links on this app, including the source tab and filters. */
export function documentReturnPath(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  return value;
}
