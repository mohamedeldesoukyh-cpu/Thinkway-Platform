import { ApifyPreflightCache, type DatasetRevision } from "./apify-preflight-cache";
import type { ReadProgress } from "./preflight-get";

type Reader = {
  apify<T>(path: string): Promise<T>;
  datasetPage(id: string, offset: number, limit: number): Promise<{ items: unknown[]; total: number }>;
};
export type ScanOptions = {
  cache?: ApifyPreflightCache;
  concurrency?: number;
  pageSize?: number;
  progress?: (event: ReadProgress) => void;
};
const equal = (a: DatasetRevision, b: DatasetRevision) => a.itemCount === b.itemCount && a.modifiedAt === b.modifiedAt;

export async function readDataset(reader: Reader, id: string, options: ScanOptions = {}) {
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid dataset identity");
  const pageSize = options.pageSize ?? 10_000;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50_000) throw new Error("Invalid dataset page size");
  const metadata = async (): Promise<DatasetRevision> => {
    const { data } = await reader.apify<{ data: DatasetRevision & { id: string } }>(`datasets/${id}`);
    if (data?.id !== id || !Number.isSafeInteger(data.itemCount) || data.itemCount < 0 ||
        !Number.isFinite(Date.parse(data.modifiedAt))) throw new Error(`Unverifiable dataset metadata (${id})`);
    return { itemCount: data.itemCount, modifiedAt: data.modifiedAt };
  };
  let cached = await options.cache?.load(id);
  if (cached) {
    const current = await metadata();
    if (!equal(cached.revision, current)) {
      options.progress?.({ event: "cache-invalidated", dataset: id });
      cached = null;
    } else {
      options.progress?.({ event: "cache-hit", dataset: id, rows: cached.rows.length });
      if (cached.rows.length === current.itemCount) return cached.rows;
    }
  }
  const rows: unknown[] = cached?.rows ?? [];
  let pages = cached?.pages ?? [];
  let revision = cached?.revision;
  let total: number | undefined = revision?.itemCount;
  // First items response provides the exact total, eliminating a pre-read
  // metadata request for the common single-page dataset (including empty ones).
  do {
    const offset = rows.length;
    const page = await reader.datasetPage(id, offset, pageSize);
    if (!Number.isSafeInteger(page.total) || page.total < 0 || !Array.isArray(page.items) ||
        (total !== undefined && page.total !== total) || page.items.length > pageSize ||
        (!page.items.length && offset < page.total) || offset + page.items.length > page.total) {
      throw new Error(`Incomplete or changing dataset (${id}, offset ${offset})`);
    }
    total = page.total;
    const firstPage = !revision;
    if (firstPage) {
      revision = await metadata();
      if (revision.itemCount !== total) throw new Error(`Dataset changed during read (${id})`);
    }
    // Checkpoint each page. A partial dataset is NEVER returned to the planner.
    if (options.cache) pages = await options.cache.checkpoint(id, revision!, pages, offset, page.items);
    for (const item of page.items) rows.push(item);
    options.progress?.({ event: "dataset-page", dataset: id, offset, rows: rows.length, total });
    if (rows.length === total) {
      if (!firstPage && !equal(revision!, await metadata())) throw new Error(`Dataset changed during read (${id})`);
      return rows;
    }
  } while (rows.length < total);
  throw new Error(`Incomplete dataset (${id})`);
}

/** Bounded workers drain before rejecting; no background reads survive a failed scan. */
export async function scanDatasets(
  reader: Reader, datasetIds: string[], consume: (id: string, rows: unknown[]) => void,
  options: ScanOptions = {},
) {
  const concurrency = options.concurrency ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("Invalid scan concurrency");
  const ids = [...new Set(datasetIds)];
  let cursor = 0, completed = 0;
  let failure: Error | undefined;
  options.progress?.({ event: "datasets-start", total: ids.length, concurrency });
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
    while (!failure && cursor < ids.length) {
      const id = ids[cursor++]!;
      try {
        const rows = await readDataset(reader, id, options);
        consume(id, rows);
        options.progress?.({ event: "dataset-complete", dataset: id, completed: ++completed, total: ids.length });
      } catch (error) {
        failure ??= new Error(`Dataset ${id} failed; preflight incomplete. ${error instanceof Error ? error.message : "Read failed"}`);
      }
    }
  }));
  if (failure) throw failure;
  return { uniqueDatasets: ids.length, completedDatasets: completed };
}
