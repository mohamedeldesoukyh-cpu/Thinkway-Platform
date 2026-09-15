/** Local Apify-only checkpoints. Production rows and request credentials never enter this API. */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, lstat, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname, join } from "node:path";

export type DatasetRevision = { itemCount: number; modifiedAt: string };
type PageRef = { offset: number; count: number; hash: string };
type Manifest = { version: 1; datasetId: string; revision: DatasetRevision; pages: PageRef[] };
export type CachedDataset = { revision: DatasetRevision; rows: unknown[]; pages: PageRef[] };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const validId = (id: string) => /^[\w-]+$/.test(id);

export class ApifyPreflightCache {
  private constructor(private root: string, private forbidden: string[]) {}

  static async open(directory: string, forbidden: string[] = []) {
    const base = await realpath(process.cwd());
    const root = resolve(base, directory);
    const rel = relative(base, root);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Cache must be inside the repository");
    // Refuse symlinks/junctions along the writable path, including existing cache files.
    let cursor = base;
    for (const segment of rel.split(/[\\/]/)) {
      cursor = join(cursor, segment);
      try { await mkdir(cursor); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
      const info = await lstat(cursor);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe cache directory");
    }
    return new ApifyPreflightCache(root, forbidden.filter(Boolean));
  }

  private async file(name: string) {
    const path = join(this.root, name);
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("Unsafe cache file");
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    return path;
  }

  private async write(name: string, value: unknown) {
    const text = JSON.stringify(value);
    if (this.forbidden.some(secret => text.includes(secret) || text.includes(JSON.stringify(secret).slice(1, -1)))) {
      throw new Error("Credential-like content refused by Apify cache");
    }
    const destination = await this.file(name);
    const temporary = join(dirname(destination), `checkpoint-${randomUUID()}.tmp`);
    await writeFile(temporary, text, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  }

  async load(datasetId: string): Promise<CachedDataset | null> {
    if (!validId(datasetId)) throw new Error("Invalid dataset identity");
    try {
      const manifest = JSON.parse(await readFile(await this.file(`${datasetId}.json`), "utf8")) as Manifest;
      if (manifest.version !== 1 || manifest.datasetId !== datasetId || !Array.isArray(manifest.pages) ||
          !Number.isSafeInteger(manifest.revision?.itemCount) || manifest.revision.itemCount < 0 ||
          !Number.isFinite(Date.parse(manifest.revision.modifiedAt))) return null;
      const rows: unknown[] = [];
      for (const page of manifest.pages) {
        if (page.offset !== rows.length || !Number.isSafeInteger(page.count) || page.count < 0 || !/^[a-f0-9]{64}$/.test(page.hash)) return null;
        const text = await readFile(await this.file(`${page.hash}.page.json`), "utf8");
        if (hash(text) !== page.hash) return null;
        const items: unknown = JSON.parse(text);
        if (!Array.isArray(items) || items.length !== page.count) return null;
        for (const item of items) rows.push(item);
      }
      if (rows.length > manifest.revision.itemCount) return null;
      return { revision: manifest.revision, rows, pages: manifest.pages };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || e instanceof SyntaxError) return null;
      throw e;
    }
  }

  async checkpoint(datasetId: string, revision: DatasetRevision, pages: PageRef[], offset: number, items: unknown[]) {
    if (!validId(datasetId)) throw new Error("Invalid dataset identity");
    const digest = hash(JSON.stringify(items));
    await this.write(`${digest}.page.json`, items);
    const next = [...pages, { offset, count: items.length, hash: digest }];
    // Only these explicitly selected metadata fields are persisted. The Apify
    // metadata response may itself contain signing secrets and must never be saved.
    await this.write(`${datasetId}.json`, {
      version: 1, datasetId,
      revision: { itemCount: revision.itemCount, modifiedAt: revision.modifiedAt }, pages: next,
    } satisfies Manifest);
    return next;
  }
}
