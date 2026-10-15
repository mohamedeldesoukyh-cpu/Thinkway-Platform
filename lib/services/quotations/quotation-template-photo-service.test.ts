import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { normalizeQuotationTemplatePhoto, saveQuotationTemplatePhoto } from "./quotation-template-photo-service";
import { applyQuotationTemplatePhotos, readQuotationTemplatePhotos, TEMPLATE_PHOTO_MAX_BYTES } from "@/lib/quotations/quotation-template-photos";
import type { QuotationItemRow } from "@/features/quotations/types";

const creator = { id: "item-a", unified_id: "creator-a", influencer_id: null, profile_id: null, creator_name: "QA", handle: "qa" };
function fixture(overrides = {}, item: unknown = creator, updated: unknown = {id: "q"}) {
  const quotation = {metadata: {hideCostAndFees: true, creatorListOrder: ["a", "b"], unrelated: {keep: 1}}, status: "draft", is_archived: false, updated_at: "2026-10-15T00:00:00Z", ...overrides};
  const writes: {table: string; patch: Record<string, unknown>; filters: [string, unknown][]}[] = [];
  const queries: {table: string; filters: [string, unknown][]}[] = [];
  const db = {from(table: string) {
    const query = {table, filters: [] as [string, unknown][]}; queries.push(query); let mutation = false;
    const builder = {select: () => builder, eq: (key: string, value: unknown) => {query.filters.push([key,value]); return builder;},
      update: (patch: Record<string, unknown>) => {mutation = true; writes.push({...query,patch}); return builder;},
      maybeSingle: async () => ({data: mutation ? updated : table === "quotations" ? quotation : item, error: null})};
    return builder;
  }};
  return {db: db as never, quotation, writes, queries};
}
const image = () => sharp({create: {width: 800, height: 1200, channels: 3, background: "#332b70"}}).png().toBuffer();
async function file() {return new File([new Uint8Array(await image())], "dummy.png", {type: "image/png"});}

test("photo pixels are decoded, EXIF stripped and portrait proportions retained within a small raster", async () => {
  const data = await normalizeQuotationTemplatePhoto(await image());
  const meta = await sharp(Buffer.from(data.split(",")[1], "base64")).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.width, 512); assert.equal(meta.height, 768); assert.equal(meta.exif, undefined);
  for (const bytes of [Buffer.alloc(0), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>'), Buffer.from("not an image"), Buffer.alloc(TEMPLATE_PHOTO_MAX_BYTES+1)]) {
    await assert.rejects(() => normalizeQuotationTemplatePhoto(bytes));
  }
});
test("saving is quotation-scoped metadata only, with exact creator membership and concurrent-edit protection", async () => {
  const f = fixture(); const before = structuredClone(f.quotation);
  const result = await saveQuotationTemplatePhoto(f.db, "q", "item-a", await file());
  assert.equal(result.ok, true); assert.equal(f.writes.length, 1); assert.equal(f.writes[0].table, "quotations");
  assert.deepEqual(Object.keys(f.writes[0].patch).sort(), ["metadata", "updated_at"]);
  assert.deepEqual(f.quotation, before);
  assert.deepEqual(f.queries[1].filters, [["quotation_id", "q"], ["id", "item-a"]]);
  assert.deepEqual(f.writes[0].filters, [["id", "q"], ["updated_at", before.updated_at], ["status", "draft"], ["is_archived", false]]);
  const metadata = f.writes[0].patch.metadata as Record<string, unknown>;
  assert.deepEqual({...metadata, templateCreatorPhotos: undefined}, {...before.metadata, templateCreatorPhotos: undefined});
  assert.ok(readQuotationTemplatePhotos(metadata)["u:creator-a"]?.startsWith("data:image/webp;base64,"));
});
test("locked, archived, foreign/deleted line, invalid image and stale saves are rejected", async () => {
  for (const overrides of [{status:"approved"}, {status:"archived"}, {is_archived:true}]) {
    const f=fixture(overrides); assert.equal((await saveQuotationTemplatePhoto(f.db,"q","item-a",await file())).ok,false); assert.equal(f.writes.length,0);
  }
  const foreign=fixture({},null); assert.equal((await saveQuotationTemplatePhoto(foreign.db,"q","foreign",await file())).ok,false); assert.equal(foreign.writes.length,0);
  const invalid=fixture(); assert.equal((await saveQuotationTemplatePhoto(invalid.db,"q","item-a",new File(["bad"],"bad.png",{type:"image/png"}))).ok,false); assert.equal(invalid.writes.length,0);
  const stale=fixture({},creator,null); assert.equal((await saveQuotationTemplatePhoto(stale.db,"q","item-a",await file())).ok,false);
});
test("restoring removes only this creator's override; template projection does not change profile records or other quotations", async () => {
  const photo=await normalizeQuotationTemplatePhoto(await image());
  const f=fixture({metadata:{templateCreatorPhotos:{"u:creator-a":photo,"u:creator-b":photo},creatorListOrder:["a","b"]}});
  assert.equal((await saveQuotationTemplatePhoto(f.db,"q","item-a",null)).ok,true);
  assert.deepEqual(f.writes[0].patch.metadata,{templateCreatorPhotos:{"u:creator-b":photo},creatorListOrder:["a","b"]});
  const rows=[{...creator,profile_image_url:"original",creator_profile_source:{avatarUrl:"profile-original"}},{...creator,id:"item-option-2"},{...creator,id:"other",unified_id:"creator-b"}] as QuotationItemRow[];
  const before=structuredClone(rows); const projected=applyQuotationTemplatePhotos(rows,{"u:creator-a":photo});
  assert.equal(projected[0].creator_profile_source?.avatarUrl,photo); assert.equal(projected[1].profile_image_url,photo); assert.equal(projected[2],rows[2]);
  assert.deepEqual(rows,before); assert.deepEqual(applyQuotationTemplatePhotos(rows,{}),rows);
  assert.deepEqual(readQuotationTemplatePhotos({templateCreatorPhotos:{bad:"javascript:alert(1)",svg:"data:image/svg+xml;base64,abc"}}),{});
});
