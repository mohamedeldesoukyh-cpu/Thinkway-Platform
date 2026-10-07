import type { searchNormalDiscoveryAction } from "./normal-search-action";

/** Read-only searches can be cancelled and never queue behind Server Actions. */
export async function searchNormalDiscoveryClient(
  input: Parameters<typeof searchNormalDiscoveryAction>[0],
  brief: Parameters<typeof searchNormalDiscoveryAction>[1],
  signal: AbortSignal,
): Promise<Awaited<ReturnType<typeof searchNormalDiscoveryAction>>> {
  const response = await fetch("/api/discovery/search", {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    signal, body: JSON.stringify({ input, brief }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not search creators.");
  return result;
}
