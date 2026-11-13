import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDevSigningEmailCapture } from './dev-signing-email-capture';
import type { SupabaseClient } from '@supabase/supabase-js';

test('Dev capture is opt-in, refuses Production/non-synthetic mail, and retains exact attachment bytes', async () => {
  const prior = { ...process.env };
  const uploads: { path: string; evidence: { attachments: { contentBase64: string }[]; testOnly: boolean } }[] = [];
  const db = { storage: { from: () => ({ upload: async (path: string, bytes: Buffer) => {
    uploads.push({ path, evidence: JSON.parse(bytes.toString().match(/id="mail-evidence">(.*?)<\/script>/s)![1]) }); return { error: null };
  } }) } } as unknown as SupabaseClient;
  const io = { id: 'synthetic', document_number: 'VIO-SIGNING-QA-test' };
  const mail = { to: [{ email: 'traffic@thinkwaymedia.com' }], subject: 'test', html: '<p>test</p>', attachments: [{ filename: 'signed.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-test') }] };
  try {
    delete process.env.SIGNING_DEV_EMAIL_CAPTURE;
    assert.equal(createDevSigningEmailCapture(db, io, 'creator@example.invalid'), undefined);
    process.env.SIGNING_DEV_EMAIL_CAPTURE = '1';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://hsxrewjcbvmbkqdlzjhs.supabase.co';
    process.env.VERCEL_ENV = 'production';
    assert.equal((await createDevSigningEmailCapture(db, io, 'creator@example.invalid')!(mail)).ok, false);
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await createDevSigningEmailCapture(db, io, 'real@example.com')!(mail)).ok, false);
    assert.equal((await createDevSigningEmailCapture(db, { ...io, document_number: 'VIO-REAL' }, 'creator@example.invalid')!(mail)).ok, false);
    assert.equal(uploads.length, 0);
    assert.equal((await createDevSigningEmailCapture(db, io, 'creator@example.invalid')!(mail)).ok, true);
    assert.equal(uploads.length, 1);
    assert.deepEqual(Buffer.from(uploads[0].evidence.attachments[0].contentBase64, 'base64'), mail.attachments[0].content);
    assert.equal(uploads[0].evidence.testOnly, true);
  } finally {
    for (const key of ['SIGNING_DEV_EMAIL_CAPTURE', 'NEXT_PUBLIC_SUPABASE_URL', 'VERCEL_ENV']) {
      if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key];
    }
  }
});
