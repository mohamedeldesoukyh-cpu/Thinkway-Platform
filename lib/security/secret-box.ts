import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export const SECRET_BOX_KEY_ENV = "CREATOR_SOCIAL_CREDENTIAL_ENCRYPTION_KEY";

export function parseSecretBoxKey(raw: string | null | undefined): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const candidates = [
    () => Buffer.from(value, "base64url"),
    () => Buffer.from(value, "base64"),
    () => (value.length === 64 ? Buffer.from(value, "hex") : null),
  ];
  for (const read of candidates) {
    try {
      const key = read();
      if (key && key.length === KEY_LENGTH) return key;
    } catch {
      // try next encoding
    }
  }
  return null;
}

export function getSecretBoxKey(): Buffer | null {
  return parseSecretBoxKey(process.env[SECRET_BOX_KEY_ENV]);
}

export function isSecretBoxConfigured(): boolean {
  return getSecretBoxKey() !== null;
}

export function sealSecret(plaintext: string, key = getSecretBoxKey()): string {
  if (!key) {
    throw new Error("Credential encryption key is not configured.");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openSecret(payload: string, key = getSecretBoxKey()): string {
  if (!key) {
    throw new Error("Credential encryption key is not configured.");
  }
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Encrypted payload is invalid.");
  }
  const [ivPart, tagPart, dataPart] = parts;
  const iv = Buffer.from(ivPart ?? "", "base64url");
  const tag = Buffer.from(tagPart ?? "", "base64url");
  const data = Buffer.from(dataPart ?? "", "base64url");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
