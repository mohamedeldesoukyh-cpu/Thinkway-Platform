import {test} from "node:test";
import assert from "node:assert/strict";
import {rateImportIdentity} from "./import-identity";

test("All Platforms pricing keeps the real profile identity for matching and enrichment",()=>{
 for(const platform of ["all","All Platforms","all_platforms"]){
  const identity=rateImportIdentity({Platform:platform,"Profile URL":"https://instagram.com/Creator.Name/"});
  assert.equal(identity.platform,"instagram");assert.equal(identity.key,"instagram:creator.name");
  assert.equal(identity.profile_url,"https://www.instagram.com/creator.name/");
 }
});
test("a profile URL alone detects platform and identity without name, ID or handles",()=>{
 for(const [url,key] of [["https://instagram.com/Creator.Name/","instagram:creator.name"],["https://www.tiktok.com/@creator","tiktok:creator"],["https://www.youtube.com/@creator","youtube:creator"]])assert.equal(rateImportIdentity({"Profile URL":url}).key,key);
 assert.equal(rateImportIdentity({"Profile URL":"https://instagram.com/creator/",Platform:"tiktok"}).handle,"");
 for(const url of ["https://instagram.com/p/123/","https://example.com/creator","not a URL"])assert.equal(rateImportIdentity({"Profile URL":url}).handle,"");
});
test("exact platform handles and profile URLs normalize without matching names",()=>{
 for(const v of ["@Creator.Name","https://www.instagram.com/Creator.Name/?utm_source=upload"]){assert.equal(rateImportIdentity({Platform:"instagram","Instagram Handle":v}).key,"instagram:creator.name");}
 for(const v of ["bad handle","https://www.instagram.com/p/123/","https://www.tiktok.com/@creator","<script>"]){assert.equal(rateImportIdentity({Platform:"instagram","Instagram Handle":v}).handle,"");}
 assert.equal(rateImportIdentity({Platform:"instagram","Creator Name":"Creator"}).handle,"");
 assert.equal(rateImportIdentity({"Creator ID":" inf:ABC ",Platform:"instagram","Instagram Handle":"other"}).key,"inf:abc");
});
