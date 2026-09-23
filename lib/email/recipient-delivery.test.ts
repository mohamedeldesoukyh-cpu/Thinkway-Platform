import assert from "node:assert/strict";
import { it } from "node:test";
import { sendEmail } from "@/lib/email/provider";
import { buildMimeMessage } from "@/lib/email/gmail-send";
import { buildIoApprovalConfirmationSubject } from "@/lib/email/io-approval-emails";

const message = {
  to: [{ email: "client@example.com" }],
  cc: [{ email: "copy@example.com" }],
  bcc: [{ email: "traffic@thinkwaymedia.com" }, { email: "sender@example.com" }],
  subject: "Client IO", html: "<p>Review document</p>",
};

it("forwards TO/CC/BCC through the active provider without putting blind copies in the body", async () => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { provider: process.env.EMAIL_PROVIDER, key: process.env.RESEND_API_KEY };
  try {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "mock-only";
    let payload: Record<string, unknown> | undefined;
    globalThis.fetch = async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "mock-message" }), { status: 200 });
    };
    assert.equal((await sendEmail(message)).ok, true);
    assert.deepEqual(payload?.to, ["client@example.com"]);
    assert.deepEqual(payload?.cc, ["copy@example.com"]);
    assert.deepEqual(payload?.bcc, ["traffic@thinkwaymedia.com", "sender@example.com"]);
    assert.doesNotMatch(String(payload?.html), /sender@example.com|traffic@thinkwaymedia.com/);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of [["EMAIL_PROVIDER", previousEnv.provider], ["RESEND_API_KEY", previousEnv.key]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  }
});

it("includes CC and BCC envelope headers for Gmail submission", () => {
  const mime = buildMimeMessage(message, { clientId: "mock", clientSecret: "mock", refreshToken: "mock", fromName: "Traffic", fromEmail: "traffic@thinkwaymedia.com" });
  assert.match(mime, /\r\nTo: client@example.com\r\nCc: copy@example.com\r\nBcc: traffic@thinkwaymedia.com, sender@example.com\r\n/);
});

it("uses the quotation number in client approval confirmations while retaining IO tracking", () => {
  assert.equal(buildIoApprovalConfirmationSubject({ kind: "client", documentNumber: "CIO-2026-0005", quotationNumber: "QT-2026-0028-V2" }),
    "Approved quotation QT-2026-0028-V2 – CIO-2026-0005 – Thinkway Media");
  assert.match(buildIoApprovalConfirmationSubject({ kind: "vendor", documentNumber: "VIO-1", quotationNumber: "QT-1" }), /^Vendor IO VIO-1/);
});
