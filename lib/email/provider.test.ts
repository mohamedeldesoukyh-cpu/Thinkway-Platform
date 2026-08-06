import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertOutboundEmailReady,
  getEmailProvider,
  getOutboundEmailRuntimeStatus,
} from "@/lib/email/provider";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "RESEND_API_KEY",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_FROM_EMAIL",
] as const;

const snapshot: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function captureEnv() {
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEmailEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("getEmailProvider", () => {
  captureEnv();
  afterEach(() => {
    restoreEnv();
  });

  it("uses Resend when EMAIL_PROVIDER=resend even without key (selection only)", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "resend";
    assert.equal(getEmailProvider(), "resend");
  });

  it("uses Gmail only when EMAIL_PROVIDER=gmail", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "gmail";
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(getEmailProvider(), "gmail");
  });

  it("does not fall back to Gmail when EMAIL_PROVIDER is empty and Resend key exists", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "";
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(getEmailProvider(), "resend");
  });

  it("defaults to Resend when EMAIL_PROVIDER unset and Resend key exists", () => {
    clearEmailEnv();
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(getEmailProvider(), "resend");
  });

  it("defaults to Resend when nothing is configured (platform IO default)", () => {
    clearEmailEnv();
    assert.equal(getEmailProvider(), "resend");
  });

  it("uses Gmail when EMAIL_PROVIDER unset, no Resend key, but Gmail OAuth present", () => {
    clearEmailEnv();
    process.env.GMAIL_CLIENT_ID = "id";
    process.env.GMAIL_CLIENT_SECRET = "secret";
    process.env.GMAIL_REFRESH_TOKEN = "token";
    assert.equal(getEmailProvider(), "gmail");
  });
});

describe("assertOutboundEmailReady", () => {
  captureEnv();
  afterEach(() => {
    restoreEnv();
  });

  it("blocks Resend send when key missing", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "resend";
    const result = assertOutboundEmailReady();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /RESEND_API_KEY/i);
    }
  });

  it("allows Resend send when key present", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    assert.deepEqual(assertOutboundEmailReady(), { ok: true });
  });

  it("reports runtime status without secrets", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_secret_value";
    process.env.EMAIL_FROM = "Thinkway Media Traffic <traffic@thinkwaymedia.com>";
    const status = getOutboundEmailRuntimeStatus();
    assert.equal(status.provider, "resend");
    assert.equal(status.resendConfigured, true);
    assert.equal(status.sendReady, true);
    assert.equal(status.fromAddress, "traffic@thinkwaymedia.com");
    assert.ok(!JSON.stringify(status).includes("re_secret_value"));
  });
});
