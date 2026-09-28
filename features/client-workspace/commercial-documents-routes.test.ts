import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import Module from "node:module";
import path from "node:path";

// Execute the real handlers with isolated services. No database, email or approval RPC is reachable.
async function handler(entry: string, fixture: any) {
  const { outputFiles } = await build({ entryPoints: [entry], bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    plugins: [{ name: "fixture-services", setup(b) {
      b.onResolve({ filter: /commercial-documents$|client-quotation-pdf$|complete-io-approval-by-token$|render-live-client-io-html$|vendor-io-pdf$/ }, a => ({ path: a.path, namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `module.exports = globalThis.__commercialFixture;`, loader: "js" }));
    } }],
  });
  (globalThis as any).__commercialFixture = fixture;
  const m = new Module(path.resolve("fixture-route.cjs"));
  m.paths = (Module as any)._nodeModulePaths(process.cwd());
  (m as any)._compile(outputFiles[0].text, path.resolve("fixture-route.cjs"));
  delete (globalThis as any).__commercialFixture;
  return m.exports;
}

test("Client IO endpoints: scoped current snapshot, inline/download, approval and final document", async () => {
  const token = "fixture-sent-token";
  let io: any = { id: "io-current", status: "sent", document_number: "TEST-CIO", terms_html: "<body>Saved terms 123</body>", approved_at: null,
    approval_token_hash: createHash("md5").update(token).digest("hex"), approval_token_expires_at: "2099-01-01" };
  let rendered = "", approvals = 0, liveRenders = 0;
  const scopes: any[] = [];
  const db = { from(table: string) {
    const q: any = { select: () => q, eq: (k: string, v: unknown) => { scopes.push([table,k,v]); return q; }, order: () => q,
      limit: () => q, maybeSingle: async () => ({ data: io }),
      then: (resolve: any) => resolve({ data: [{ payload: { approval_url: `https://fixture.test/io-approval/client?token=${token}` } }] }),
    }; return q;
  } };
  const route = await handler("app/api/review/client-io/route.ts", {
    resolveCommercialDocuments: async (sign: string) => { if (sign !== "valid") throw Error("Denied"); return { db, campaignId: "campaign-allowed" }; },
    renderHtmlToPdf: async (html: string) => { rendered = html; return { ok: true, buffer: Buffer.from("%PDF-fixture") }; },
    INSERTION_ORDER_PDF_OPTIONS: {},
    renderLiveClientIoHtml: async () => { liveRenders++; return "<body>Draft terms</body>"; },
    completeClientIoApprovalByToken: async ({ token: received }: any) => { assert.equal(received, token); approvals++; io = { ...io, status: "approved", approved_at: "2026-09-28T12:00:00Z", approval_token_hash: null }; return { ok: true }; },
  });
  const get = (q: string) => route.GET(new Request(`https://fixture.test/api/review/client-io?${q}`));
  const post = (id: string) => route.POST(new Request("https://fixture.test/api/review/client-io?sign=valid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ioId: id, email: "fixture@example.test" }) }));
  assert.equal((await get("sign=invalid&format=status")).status,403);
  assert.equal((await (await get("sign=valid&format=status")).json()).io.canApprove,true);
  assert.equal((await get("sign=valid&ioId=another-campaign")).status,409);
  assert.equal((await post("older-revision")).status,409);
  assert.equal(approvals,0);
  const view = await get("sign=valid&ioId=io-current&view=1");
  assert.match(view.headers.get("content-disposition"),/^inline/);
  assert.equal(rendered,io.terms_html);
  assert.equal(liveRenders,0);
  assert.match((await get("sign=valid&ioId=io-current")).headers.get("content-disposition"),/^attachment/);
  assert.equal((await post("io-current")).status,200);
  assert.equal(approvals,1);
  const status = await (await get("sign=valid&format=status")).json();
  assert.equal(status.io.approved,true); assert.equal(status.io.canApprove,false); assert.equal(status.io.available,true);
  const approved = await get("sign=valid&ioId=io-current");
  assert.match(approved.headers.get("content-disposition"),/TEST-CIO-Approved.pdf/);
  assert.match(rendered,/data-io-approval="approved"/); assert.match(rendered,/Saved terms 123/);
  assert.equal((await post("io-current")).status,200); assert.equal(approvals,1);
  // Current View/Download share the assignment renderer without changing the
  // issued snapshot or mislabelling current values as the approved document.
  for (const suffix of ["&view=1", ""]) {
    const current = await get("sign=valid&ioId=io-current&source=current"+suffix);
    assert.equal(current.status,200);
    assert.match(current.headers.get("content-disposition"),/TEST-CIO-Current.pdf/);
    assert.match(rendered,/Draft terms/);
    assert.doesNotMatch(rendered,/data-io-approval/);
    assert.equal(io.terms_html,"<body>Saved terms 123</body>");
    assert.equal(approvals,1);
  }
  const preserved = await get("sign=valid&ioId=io-current");
  assert.match(preserved.headers.get("content-disposition"),/TEST-CIO-Approved.pdf/);
  assert.match(rendered,/Saved terms 123/);
  assert.equal((await get("sign=valid&ioId=another-campaign&source=current")).status,409);
  // A generated but unissued IO can have stale saved HTML after edits.
  io = { ...io, status: "generated", terms_html: "<body>Old draft</body>" };
  assert.equal((await get("sign=valid&ioId=io-current&view=1")).status,200);
  assert.match(rendered,/Draft terms/);
  assert.doesNotMatch(rendered,/Old draft/);
  assert.equal(liveRenders,3);
  assert.equal((await get("sign=valid&ioId=io-current")).status,200);
  assert.match(rendered,/Draft terms/);
  assert.equal(liveRenders,4);
  assert.ok(scopes.some(s => s[0] === "client_ios" && s[1] === "campaign_header_id" && s[2] === "campaign-allowed"));
  assert.ok(scopes.some(s => s[1] === "is_superseded" && s[2] === false));
  assert.ok(scopes.some(s => s[0] === "io_notifications" && s[1] === "io_id" && s[2] === "io-current"));
});

test("quotation handlers use the resolved journey quotation and support view/download", async () => {
  const route = await handler("app/api/review/quotation/route.ts", {
    resolveCommercialDocuments: async () => ({ db: {}, quotationId: "journey-current" }),
    renderExistingQuotationPdf: async ({ quotationId }: any) => { assert.equal(quotationId,"journey-current"); return { ok:true, buffer: Buffer.from("%PDF-fixture"), filename:"QT-test.pdf" }; },
  });
  for (const [suffix, disposition] of [["", "attachment"], ["&view=1", "inline"]]) {
    const response = await route.GET(new Request(`https://fixture.test/api/review/quotation?sign=fixture${suffix}`));
    assert.equal(response.status,200); assert.equal(response.headers.get("content-type"),"application/pdf");
    assert.match(response.headers.get("content-disposition"),new RegExp(`^${disposition}`));
    assert.equal(response.headers.get("cache-control"),"private, no-store");
  }
});
