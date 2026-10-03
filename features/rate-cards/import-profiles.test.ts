import {test} from "node:test";
import assert from "node:assert/strict";
import {rateImportProfiles} from "./import-profiles";
test("one row detects and deduplicates multiple social URLs",()=>{
 const profiles=rateImportProfiles({"Profile URL":"https://instagram.com/creator/","Instagram Handle":"@creator","TikTok Handle":"https://tiktok.com/@creator","Other Platform Handle":"https://youtube.com/@creator; https://facebook.com/creator"});
 assert.deepEqual(profiles.map(p=>p.platform),["instagram","tiktok","youtube","facebook"]);
 assert.throws(()=>rateImportProfiles({"Other Platform Handle":"https://example.com/wrong"}));
 assert.throws(()=>rateImportProfiles({"TikTok Handle":"https://instagram.com/wrong"}));
});
