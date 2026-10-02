import {test} from "node:test";
import assert from "node:assert/strict";
import {rateImportIdentity} from "./import-identity";
test("exact platform handles and profile URLs normalize without matching names",()=>{
 for(const v of ["@Creator.Name","https://www.instagram.com/Creator.Name/?utm_source=upload"]){assert.equal(rateImportIdentity({Platform:"instagram","Instagram Handle":v}).key,"instagram:creator.name");}
 for(const v of ["bad handle","https://www.instagram.com/p/123/","https://www.tiktok.com/@creator","<script>"]){assert.equal(rateImportIdentity({Platform:"instagram","Instagram Handle":v}).handle,"");}
 assert.equal(rateImportIdentity({Platform:"instagram","Creator Name":"Creator"}).handle,"");
 assert.equal(rateImportIdentity({"Creator ID":" inf:ABC ",Platform:"instagram","Instagram Handle":"other"}).key,"inf:abc");
});
