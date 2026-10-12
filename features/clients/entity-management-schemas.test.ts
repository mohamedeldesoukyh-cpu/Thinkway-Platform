import assert from "node:assert/strict";
import test from "node:test";
import { deleteEntitySchema, moveBrandSchema } from "./entity-management-schemas";
import { createBrandSchema } from "../brands/schemas";
const id="10000000-0000-4000-8000-000000000001";
const other="10000000-0000-4000-8000-000000000002";
test("brand creation requires an explicit valid client",()=>{
 for(const client_id of [undefined,null,"","not-a-client"]){assert.equal(createBrandSchema.safeParse({name:"Brand",client_id}).success,false);}
 assert.equal(createBrandSchema.safeParse({name:"Brand",client_id:id}).success,true);
});
test("move rejects missing, invalid and same destination",()=>{
 for(const clientId of [undefined,"",id,"wrong"]){assert.equal(moveBrandSchema.safeParse({id,previousClientId:id,clientId}).success,false);}
 assert.equal(moveBrandSchema.safeParse({id,previousClientId:id,clientId:other}).success,true);
});
test("deletion accepts only named client/brand targets",()=>{
 for(const kind of ["campaign","invoices",undefined]) assert.equal(deleteEntitySchema.safeParse({kind,id,confirmation:"Name"}).success,false);
 assert.equal(deleteEntitySchema.safeParse({kind:"brand",id,confirmation:""}).success,false);
 assert.equal(deleteEntitySchema.safeParse({kind:"client",id,confirmation:"Name"}).success,true);
});
