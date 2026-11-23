import assert from "node:assert/strict";
import { requestCreatorPlatforms } from "./quotation-platform-batch";

async function main() {
  const original = globalThis.fetch;
  const sizes: number[] = [];
  globalThis.fetch = async (_url, init) => {
    const refs = JSON.parse(String(init?.body)) as { unified_id: string }[];
    sizes.push(refs.length);
    return Response.json(refs.map(ref => [{ platform: "instagram", handle: ref.unified_id, followers: 100, engagement_rate: 1 }]));
  };
  try {
    const rows = await Promise.all(Array.from({ length: 10 }, (_, i) => requestCreatorPlatforms({ unified_id: String(i) })));
    assert.deepEqual(sizes, [10], "ten creators use one request");
    assert.equal(rows[7][0].handle, "7", "results stay associated with the creator");
    sizes.length = 0;
    await Promise.all(Array.from({ length: 201 }, (_, i) => requestCreatorPlatforms({ unified_id: String(i) })));
    assert.deepEqual(sizes, [100, 100, 1], "large selections respect the server limit");
    globalThis.fetch = async () => new Response(null, { status: 403 });
    await assert.rejects(requestCreatorPlatforms({ unified_id: "denied" }));
    globalThis.fetch = async () => Response.json([]);
    await assert.rejects(requestCreatorPlatforms({ unified_id: "missing" }));
    console.log("PASS: platform batching, chunking, result association and failure handling");
  } finally { globalThis.fetch = original; }
}
void main();
