/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness compiles the isolated action into a Node Module. */
// Executes the real action and PDF renderer; external services are controlled doubles.
// No credentials, real email, database records or storage objects are used.
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
let state;
const hash = 'a'.repeat(64);
const input = { token: 'synthetic-signing-token-123', name: 'Signing Review', documentHash: hash, strokes: [[[.1,.2],[.4,.7],[.8,.2]]] };
function reset(overrides = {}) {
  state = { uploads: [], removals: [], rpc: [], emails: [], revalidated: [], ...overrides };
}
global.__signingReview = {
  async loadVendorSigningSession() {
    if (state.denied) throw new Error('APPROVAL_INVALID');
    return { db, io: { id: 'review-io', terms_html: '<html><body><h1>Synthetic Creator IO</h1><p>3 UGC</p></body></html>', document_number: 'REVIEW', campaign_header_id: 'review-campaign', influencers: { email: 'creator@example.invalid' } },
      documentHash: hash, token: input.token, actorId: null, alreadyApproved: !!state.approved,
      signature: state.approved ? { signed_pdf_path: 'review-io/signed/existing.pdf' } : null };
  },
  headers: async () => new Map([['user-agent', 'Signing review'], ['x-forwarded-for', '192.0.2.1']]),
  revalidatePath: (p) => state.revalidated.push(p),
  consumeRateLimit: () => ({ allowed: !state.limited }),
  createIoDocumentSignedUrl: async (_db, _bucket, p) => 'https://storage.example.invalid/' + p,
  sendIoApprovalConfirmationEmails: async (mail) => { state.emails.push(mail); return { approverSent: !state.emailFailed }; },
  syncCampaignHeaderStatus: async () => { state.synced = true; },
};
const db = {
  storage: { from(bucket) { assert.equal(bucket, 'vendor-io-documents'); return {
    async upload(p, bytes, options) { state.uploads.push({ p, bytes, options }); return { error: state.uploadFailed ? new Error('storage unavailable') : null }; },
    async remove(paths) { state.removals.push(...paths); return { error: null }; },
  }; } },
  async rpc(name, args) { assert.equal(name, 'sign_vendor_io'); state.rpc.push(args); return { data: { already_approved: !!state.raced }, error: state.rpcError ? new Error(state.rpcError) : null }; },
  from(table) { assert.equal(table, 'vendor_io_signatures'); return { select() { return this; }, eq() { return this; }, async maybeSingle() {
    return { data: state.commitUnknown ? { signed_pdf_path: state.uploads[0].p } : null, error: state.readFailed ? new Error('unavailable') : null };
  } }; },
};
(async () => {
  const mocks = {
    'next/headers': ['headers'], 'next/cache': ['revalidatePath'],
    '@/lib/io/vendor-io-signing-session': ['loadVendorSigningSession'],
    '@/lib/io/io-document-storage': ['createIoDocumentSignedUrl'],
    '@/lib/email/io-approval-emails': ['sendIoApprovalConfirmationEmails'],
    '@/lib/campaigns/sync-campaign-header-status': ['syncCampaignHeaderStatus'],
    '@/lib/security/rate-limit': ['consumeRateLimit'],
  };
  const result = await build({ entryPoints: ['features/io/sign-vendor-io-action.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'controlled-services', setup(b) {
    b.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'review' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'review' }, args => ({ contents: mocks[args.path].map(n => `export const ${n} = (...args) => globalThis.__signingReview.${n}(...args);`).join('\n') }));
  } }] });
  const filename = path.resolve('scripts/signing-review-runtime.cjs');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(result.outputFiles[0].text, filename);
  const sign = mod.exports.signVendorIoAction;
  let passed = 0;
  async function scenario(name, overrides, verify, data = input) { reset(overrides); await verify(await sign(data)); passed++; console.log('PASS ' + name); }
  await scenario('invalid signature cannot reach storage or approval', {}, r => { assert.equal(r.ok, false); assert.equal(state.rpc.length, 0); }, { ...input, strokes: [] });
  await scenario('unauthorized access fails closed', { denied: true }, r => { assert.equal(r.ok, false); assert.equal(state.uploads.length, 0); });
  await scenario('changed document requires review', {}, r => { assert.equal(r.ok, false); assert.equal(state.uploads.length, 0); }, { ...input, documentHash: 'b'.repeat(64) });
  await scenario('rate limit prevents rendering and upload', { limited: true }, r => { assert.equal(r.ok, false); assert.equal(state.uploads.length, 0); });
  await scenario('real PDF is stored, signed and attached with identical bytes', {}, r => {
    assert.equal(r.ok, true); assert.equal(state.uploads.length, 1); assert.equal(state.rpc.length, 1);
    const uploaded = state.uploads[0]; assert.equal(uploaded.bytes.subarray(0,5).toString(), '%PDF-'); assert.ok(uploaded.bytes.length > 1000); assert.equal(uploaded.options.upsert, false);
    assert.equal(state.rpc[0].p_pdf_path, uploaded.p); assert.match(state.rpc[0].p_signed_html, /Signed &amp; Approved/);
    assert.equal(state.rpc[0].p_document_hash, hash); assert.equal(state.rpc[0].p_ip, '192.0.2.1');
    assert.deepEqual(state.emails[0].pdfAttachment.content, uploaded.bytes); assert.ok(state.synced); assert.equal(state.removals.length, 0);
  });
  await scenario('storage failure never approves', { uploadFailed: true }, r => { assert.equal(r.ok, false); assert.equal(state.rpc.length, 0); });
  await scenario('document change during signing removes only uncommitted upload', { rpcError: 'DOCUMENT_CHANGED' }, r => { assert.equal(r.ok, false); assert.deepEqual(state.removals, [state.uploads[0].p]); });
  await scenario('transport failure after commit preserves signed PDF', { rpcError: 'timeout', commitUnknown: true }, r => { assert.equal(r.ok, true); assert.equal(state.removals.length, 0); });
  await scenario('unknown commit state never deletes possible evidence', { rpcError: 'timeout', readFailed: true }, r => { assert.equal(r.ok, false); assert.equal(state.removals.length, 0); });
  await scenario('email failure retains approval and download', { emailFailed: true }, r => { assert.equal(r.ok, true); assert.match(r.message, /could not be delivered/); assert.ok(r.downloadUrl); });
  await scenario('repeat signing returns original document without email or upload', { approved: true }, r => { assert.equal(r.ok, true); assert.match(r.downloadUrl, /existing.pdf/); assert.equal(state.uploads.length, 0); assert.equal(state.emails.length, 0); });
  console.log(`${passed} signing action scenarios passed (real local Chromium PDF; controlled external services).`);
})().catch(error => { console.error(error); process.exitCode = 1; });
