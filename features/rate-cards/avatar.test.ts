import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {normalizeRateAvatar,readRateAvatarLink,AVATAR_MAX_BYTES} from "./avatar";

test("rate-card avatars are resized and encoded as inert WebP pixels",async()=>{
  const original=await sharp({create:{width:1200,height:800,channels:3,background:"#0057ff"}}).png().toBuffer();
  const result=await normalizeRateAvatar(original);
  assert.match(result,/^data:image\/webp;base64,/);
  const meta=await sharp(Buffer.from(result.split(",")[1],"base64")).metadata();
  assert.equal(meta.width,512);assert.equal(meta.height,512);assert.equal(meta.format,"webp");
});
test("invalid, executable, and oversized avatar inputs are rejected",async()=>{
  for(const bytes of [Buffer.from("not an image"),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'),Buffer.alloc(AVATAR_MAX_BYTES+1)]){
    await assert.rejects(normalizeRateAvatar(bytes),/avatarInvalid/);
  }
});
test("avatar links reject local network, credentialed, and unsupported hosts",async()=>{
  for(const url of ["https://127.0.0.1/avatar.png","http://169.254.169.254/latest/meta-data","https://user:pass@instagram.com/avatar.jpg","https://example.invalid/avatar.png"]){
    await assert.rejects(readRateAvatarLink(url),/avatarLinkError/);
  }
});
