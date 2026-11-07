import assert from "node:assert/strict";
import test from "node:test";

import { assertCsrfRequest, isMutatingMethod } from "./csrf";

function req(init: {
  method?: string;
  origin?: string | null;
  host?: string;
  referer?: string | null;
  secFetchSite?: string | null;
  authorization?: string | null;
}) {
  const headers = new Map<string, string>();
  if (init.origin) headers.set("origin", init.origin);
  if (init.host) headers.set("host", init.host);
  if (init.referer) headers.set("referer", init.referer);
  if (init.secFetchSite) headers.set("sec-fetch-site", init.secFetchSite);
  if (init.authorization) headers.set("authorization", init.authorization);
  return {
    method: init.method ?? "POST",
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
    nextUrl: { host: init.host ?? "app.thinkway.test", protocol: "https:" },
  };
}

test("isMutatingMethod classifies verbs", () => {
  assert.equal(isMutatingMethod("GET"), false);
  assert.equal(isMutatingMethod("POST"), true);
  assert.equal(isMutatingMethod("DELETE"), true);
});

test("assertCsrfRequest allows same-origin Origin", () => {
  const result = assertCsrfRequest(
    req({
      origin: "https://app.thinkway.test",
      host: "app.thinkway.test",
    })
  );
  assert.equal(result.ok, true);
});

test("assertCsrfRequest rejects cross-site Origin", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = assertCsrfRequest(
      req({
        origin: "https://evil.example",
        host: "app.thinkway.test",
      })
    );
    assert.equal(result.ok, false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("assertCsrfRequest allows cron bearer", () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-test-secret";
  try {
    const result = assertCsrfRequest(
      req({
        origin: "https://evil.example",
        host: "app.thinkway.test",
        authorization: "Bearer cron-test-secret",
      })
    );
    assert.equal(result.ok, true);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});

test("assertCsrfRequest rejects unconfigured Vercel aliases", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = assertCsrfRequest(
      req({
        origin:
          "https://thinkway-platform-git-develop-team.vercel.app",
        host: "thinkway-platform-abc123-team.vercel.app",
      })
    );
    assert.equal(result.ok, false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("assertCsrfRequest still rejects non-vercel cross-site Origin", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const result = assertCsrfRequest(
      req({
        origin: "https://evil.example",
        host: "thinkway-platform-abc123-team.vercel.app",
      })
    );
    assert.equal(result.ok, false);
  } finally {
    process.env.NODE_ENV = prev;
  }
});


test("explicit branch alias is allowed but unrelated deployments are rejected", () => {
  const previous = process.env.VERCEL_BRANCH_URL;
  process.env.VERCEL_BRANCH_URL = "thinkway-git-develop-team.vercel.app";
  try {
    assert.equal(assertCsrfRequest(req({ origin: "https://thinkway-git-develop-team.vercel.app", host: "thinkway-unique-team.vercel.app" })).ok, true);
    assert.equal(assertCsrfRequest(req({ origin: "https://unrelated-project.vercel.app", host: "thinkway-unique-team.vercel.app" })).ok, false);
    assert.equal(assertCsrfRequest(req({ origin: "http://thinkway-unique-team.vercel.app", host: "thinkway-unique-team.vercel.app" })).ok, false);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_BRANCH_URL;
    else process.env.VERCEL_BRANCH_URL = previous;
  }
});
