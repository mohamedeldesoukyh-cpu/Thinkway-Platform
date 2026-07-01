import assert from "node:assert/strict";

import { validateProviderAvatarUrl, resolvePersistableProviderAvatarUrl } from "@/lib/performance/provider-avatar-validation";

async function testHeadFailureFallsBackToRangedGet() {
  let callCount = 0;
  const fetchFn = async (_input: string | URL | Request, init?: RequestInit) => {
    callCount += 1;
    if (init?.method === "HEAD") {
      return new Response(null, { status: 403 });
    }
    if (init?.method === "GET") {
      return new Response(new Uint8Array(4096), {
        status: 206,
        headers: { "content-range": "bytes 0-4095/8192" },
      });
    }
    throw new Error(`Unexpected fetch: ${init?.method} ${_input}`);
  };

  const result = await validateProviderAvatarUrl("https://scontent.cdninstagram.com/v/avatar.jpg", {
    fetchFn,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(callCount, 2, "HEAD 403 should fall back to ranged GET");
}

async function testHeadMissingContentLengthFallsBackToRangedGet() {
  let callCount = 0;
  const fetchFn = async (_input: string | URL | Request, init?: RequestInit) => {
    callCount += 1;
    if (init?.method === "HEAD") {
      return new Response(null, { status: 200 });
    }
    return new Response(new Uint8Array(4096), {
      status: 200,
      headers: { "content-length": "4096" },
    });
  };

  const result = await validateProviderAvatarUrl("https://cdn.example.com/avatar.jpg", {
    fetchFn,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(callCount, 2);
}

async function testTikTokPersistableSignedPrefersProbedNormalized() {
  let fetchCalls = 0;
  const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
    fetchCalls += 1;
    const url = String(input);
    if (url.includes("-sign-")) {
      if (init?.method === "HEAD") {
        return new Response(null, { status: 403 });
      }
      return new Response(new Uint8Array(4096), {
        status: 206,
        headers: { "content-range": "bytes 0-4095/8192" },
      });
    }
    if (init?.method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-length": "8192" } });
    }
    return new Response(new Uint8Array(8192), {
      status: 200,
      headers: { "content-length": "8192" },
    });
  };

  const signed =
    "https://p16-sign-va.tiktokcdn.com/a.jpg?x-expires=9999999999&x-signature=abc";
  const result = await resolvePersistableProviderAvatarUrl("tiktok", signed, { fetchFn });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url, "https://p16-va.tiktokcdn.com/a.jpg");
  }
  assert.ok(fetchCalls >= 3, "signed URL probed, then stabilized URL network-validated");
}

async function testTikTokPersistableExpiredSignedUsesStabilized() {
  const fetchFn = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("x-expires")) {
      return new Response(null, { status: 403 });
    }
    return new Response(new Uint8Array(4096), {
      status: 200,
      headers: { "content-length": "4096" },
    });
  };

  const expired =
    "https://p16-sign-va.tiktokcdn.com/a.jpg?x-expires=1661893200&x-signature=abc";
  const result = await resolvePersistableProviderAvatarUrl("tiktok", expired, { fetchFn });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url, "https://p16-va.tiktokcdn.com/a.jpg");
  }
}

testHeadFailureFallsBackToRangedGet()
  .then(() => testHeadMissingContentLengthFallsBackToRangedGet())
  .then(() => testTikTokPersistableSignedPrefersProbedNormalized())
  .then(() => testTikTokPersistableExpiredSignedUsesStabilized())
  .then(() => {
    console.log("provider-avatar-validation tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
