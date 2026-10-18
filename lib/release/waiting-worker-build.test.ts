import assert from "node:assert/strict";
import { test } from "node:test";
import { readWaitingWorkerBuild } from "./waiting-worker-build";
function worker(buildId: unknown) {
 return { postMessage: (_message: unknown, ports: Transferable[]) => (ports[0] as MessagePort).postMessage({buildId}) } as Pick<ServiceWorker,"postMessage">;
}
test("two releases at the same worker URL have distinct dismissal identities", async () => {
 const first = await readWaitingWorkerBuild(worker("1.0+release-a"));
 const next = await readWaitingWorkerBuild(worker("1.0+release-b"));
 assert.equal(first,"1.0+release-a");
 assert.equal(next,"1.0+release-b");
 assert.notEqual(first,next);
});
test("old workers time out without inventing a persistent dismissal key", async () => {
 assert.equal(await readWaitingWorkerBuild({postMessage:()=>{}} as Pick<ServiceWorker,"postMessage">, 5),null);
});
test("malformed responses and unavailable worker channels fail safely", async () => {
 assert.equal(await readWaitingWorkerBuild(worker({})),null);
 assert.equal(await readWaitingWorkerBuild({postMessage:()=>{throw new Error("gone")}} as Pick<ServiceWorker,"postMessage">),null);
});
