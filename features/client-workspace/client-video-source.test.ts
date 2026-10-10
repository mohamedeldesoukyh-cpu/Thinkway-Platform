import assert from "node:assert/strict";
import { test } from "node:test";
import { acquireClientVideoSource } from "./client-video-source";

test("video loading streams normal files, retains MOV compatibility, and releases memory", async () => {
  const originalFetch = globalThis.fetch;
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const calls: string[] = [];
  const revoked: string[] = [];
  let fileName = "clip.mp4";
  let mimeType = "video/mp4";
  let fail = false;
  let createdType = "";
  globalThis.fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    if (String(url).startsWith("/api/review/content")) return Response.json(fail ? { error: "Access denied" } : { url: "https://test.invalid/video", fileName, mimeType }, { status: fail ? 403 : 200 });
    return new Response(new Blob(["synthetic video"], { type: mimeType }));
  }) as typeof fetch;
  URL.createObjectURL = blob => { createdType = (blob as Blob).type; return "blob:synthetic"; };
  URL.revokeObjectURL = url => { revoked.push(url); };
  try {
    for (const [name, mime] of [["clip.mp4", "video/mp4"], ["clip.webm", "video/webm"]]) {
      fileName = name; mimeType = mime; calls.length = 0;
      const result = await acquireClientVideoSource("synthetic-token", "synthetic-version", new AbortController().signal);
      assert.equal(result.src, "https://test.invalid/video");
      assert.equal(calls.length, 1, "only authorization metadata, no whole-file download");
      result.release(); assert.equal(revoked.length, 0);
    }
    fileName = "clip.MOV"; mimeType = "video/quicktime"; calls.length = 0;
    const mov = await acquireClientVideoSource("synthetic-token", "synthetic-version", new AbortController().signal);
    assert.equal(calls.length, 2); assert.equal(createdType, "video/mp4");
    mov.release(); mov.release(); assert.deepEqual(revoked, ["blob:synthetic"]);
    fail = true;
    await assert.rejects(acquireClientVideoSource("synthetic-token", "synthetic-version", new AbortController().signal), /Access denied/);
    fail = false;
    const controller = new AbortController(); controller.abort();
    await assert.rejects(acquireClientVideoSource("synthetic-token", "synthetic-version", controller.signal));
    assert.equal(revoked.length, 1, "cancelled fetch must not allocate a blob");
  } finally { globalThis.fetch = originalFetch; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});
