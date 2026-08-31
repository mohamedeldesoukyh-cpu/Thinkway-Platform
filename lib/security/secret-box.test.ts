import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";

import {
  openSecret,
  parseSecretBoxKey,
  sealSecret,
} from "@/lib/security/secret-box";

describe("Secret box", () => {
  it("round-trips plaintext and rejects tampering", () => {
    const key = parseSecretBoxKey(randomBytes(32).toString("base64url"));
    assert.ok(key);
    const sealed = sealSecret("access-token-value", key);
    assert.equal(openSecret(sealed, key), "access-token-value");
    assert.doesNotMatch(sealed, /access-token-value/);
    assert.throws(() => openSecret(sealed.replace(/.$/, "A"), key));
  });
});
