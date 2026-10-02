/** Enrichment availability must not undo a successfully resolved creator. */
export async function optionalEnrichment<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch {
    // Provider errors can contain connection credentials; never log the raw error.
    return null;
  }
}
