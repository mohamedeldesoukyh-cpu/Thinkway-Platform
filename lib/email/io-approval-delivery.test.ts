import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendEmailInput } from "./provider";
import { sendIoApprovalConfirmationEmails, TRAFFIC_OPERATIONS_EMAIL } from "./io-approval-emails";

const attachment = { filename: "CIO-approved.pdf", mimeType: "application/pdf", content: Buffer.from("test PDF") };
function fixture(throwLog = false) {
  const logs: Record<string, unknown>[] = [];
  const supabase = { from: () => ({ insert: async (row: Record<string, unknown>) => {
    if (throwLog) throw new Error("Audit unavailable");
    logs.push(row); return { error: null };
  } }) } as unknown as SupabaseClient;
  return { logs, input: { supabase, kind: "client" as const, ioId: "test-io", documentNumber: "CIO-2026-0005",
    quotationNumber: "QT-2026-0028-V2", campaignName: "Test campaign", approvedAt: "2026-09-28T12:00:00Z",
    approvedByEmail: "client@example.com", pdfAttachment: attachment } };
}

test("both recipients receive the approved PDF, approval date and quotation reference", async () => {
  const { input, logs } = fixture(); const sent: SendEmailInput[] = [];
  const result = await sendIoApprovalConfirmationEmails(input, async (mail) => { sent.push(mail); return { ok: true, messageId: "test" }; });
  assert.deepEqual(result, { approverSent: true, internalSent: true });
  assert.equal(logs.length, 2);
  for (const mail of sent) {
    assert.match(mail.subject, /Approved quotation QT-2026-0028-V2/);
    assert.match(mail.html, /28 Sept? 2026/);
    assert.deepEqual(mail.attachments, [attachment]);
  }
});

test("Traffic is notified even without an approver email or PDF", async () => {
  const { input } = fixture(); const sent: SendEmailInput[] = [];
  const result = await sendIoApprovalConfirmationEmails({ ...input, approvedByEmail: null, pdfAttachment: null }, async (mail) => { sent.push(mail); return { ok: true, messageId: "test" }; });
  assert.deepEqual(result, { approverSent: false, internalSent: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to[0].email, TRAFFIC_OPERATIONS_EMAIL);
  assert.match(sent[0].text!, /PDF could not be prepared/);
});

test("failed approver delivery and audit cannot suppress Traffic", async () => {
  const { input } = fixture(true); const recipients: string[] = [];
  const result = await sendIoApprovalConfirmationEmails(input, async (mail) => {
    recipients.push(mail.to[0].email);
    if (mail.to[0].email !== TRAFFIC_OPERATIONS_EMAIL) throw new Error("Client delivery failed");
    return { ok: true, messageId: "test" };
  });
  assert.deepEqual(result, { approverSent: false, internalSent: true });
  assert.equal(recipients.length, 2);
});
