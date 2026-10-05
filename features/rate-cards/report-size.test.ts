import assert from "node:assert/strict";
import {test} from "node:test";
import sharp from "sharp";
import {fixture} from "./report-test-fixture";
import {buildRateCardReportHtml,rateReportPdfOptions} from "./report";
import {rateReportPlatformIcon} from "./report-icons";
import {compactReportAvatar} from "./report-avatar";
import {addRatePreviewNavigation} from "./report-preview";

test("300-creator reports do not repeat original full-size platform artwork",()=>{
 const doc={...fixture,creators:Array.from({length:300},(_,i)=>({...fixture.creators[1],group:{...fixture.creators[1].group,creatorKey:String(i)}}))};
 const before=process.memoryUsage().heapUsed;
 const html=buildRateCardReportHtml(doc,"creator-list");
 assert.equal((html.match(/class="creator-card"/g)||[]).length,300);
 assert.ok(Buffer.byteLength(html)<12_000_000,`Report size: ${Buffer.byteLength(html)}`);
 assert.ok(process.memoryUsage().heapUsed-before<100_000_000,"Large report must stay well below the server heap limit");
 for(const platform of ["instagram","facebook","tiktok","youtube","linkedin"])assert.ok(rateReportPlatformIcon(platform)!.length<5000);
 assert.equal(rateReportPdfOptions(doc,"creator-list").width,"297mm");
 assert.equal(rateReportPdfOptions(doc,"creator-list").height,"210mm");
});

test("preview navigation preserves template and language while complete download clears page",()=>{
 const html=addRatePreviewNavigation('<html><head></head><body>report</body></html>',new URL('https://example.com/api/rate-cards/id/export?template=creator-list-details&lang=ar&format=html&page=2'),{page:2,pages:25,total:300},"ar");
 assert.match(html,/page=1/);assert.match(html,/page=3/);assert.match(html,/template=creator-list-details/);
 assert.match(html,/lang=ar/);assert.match(html,/format=html&amp;download=1/);
 assert.ok(!html.includes('page=2&amp;download'));
});

test("report photos are bounded thumbnails and invalid images fall back safely",async()=>{
 const original=await sharp({create:{width:1600,height:1200,channels:3,background:'#365789'}}).png().toBuffer();
 const data=await compactReportAvatar('data:image/png;base64,'+original.toString('base64'));
 assert.ok(data);const bytes=Buffer.from(data.split(',')[1],'base64');const meta=await sharp(bytes).metadata();
 assert.equal(meta.width,320);assert.equal(meta.height,240);assert.ok(bytes.length<15000);
 assert.equal(await compactReportAvatar('data:image/png;base64,bm90YW5pbWFnZQ=='),null);
});
