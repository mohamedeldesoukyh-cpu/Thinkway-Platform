import assert from "node:assert/strict";
import { test } from "node:test";
import { withQuotationConversionLock } from "./quotation-conversion-lock";

function lockClient() {
  let owner: string | null = null;
  return {
    async rpc(name: string, args: { p_token: string }) {
      if (name === "acquire_quotation_conversion") {
        if (owner) return { data: false, error: null };
        owner = args.p_token;
        return { data: true, error: null };
      }
      if (owner === args.p_token) owner = null;
      return { data: null, error: null };
    },
  };
}

test("overlapping requests execute conversion only once; a later retry can resume", async () => {
  const client = lockClient();
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  let calls = 0;
  const first = withQuotationConversionLock(client, "quote", async () => {
    calls++;
    await wait;
    return { ok: true };
  });
  const second = await withQuotationConversionLock(client, "quote", async () => { calls++; return { ok: true }; });
  assert.equal(second.ok, false);
  assert.equal(calls, 1);
  finish();
  await first;
  assert.deepEqual(await withQuotationConversionLock(client, "quote", async () => ({ ok: true })), { ok: true });
});

test("failed conversion releases the lease for a retry", async () => {
  const client = lockClient();
  await assert.rejects(withQuotationConversionLock(client, "quote", async () => { throw new Error("failed"); }), /failed/);
  assert.deepEqual(await withQuotationConversionLock(client, "quote", async () => ({ ok: true })), { ok: true });
});

test("database errors fail closed without creating a campaign", async () => {
  let called = false;
  const result = await withQuotationConversionLock({ rpc: async () => ({ data: null, error: { message: "unavailable" } }) }, "quote", async () => { called = true; });
  assert.deepEqual(result, { ok: false, message: "unavailable" });
  assert.equal(called, false);
});
