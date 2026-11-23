/** Bound database fan-out while preserving the queue's original campaign order. */
export async function mapBillingCampaigns<T, R>(items: readonly T[], load: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += 4) {
    results.push(...await Promise.all(items.slice(offset, offset + 4).map(load)));
  }
  return results;
}
