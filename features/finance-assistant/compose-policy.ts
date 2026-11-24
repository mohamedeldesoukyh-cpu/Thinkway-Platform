import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {financeAttachmentSchema} from "./mail-policy";
export const recipientsSchema=z.object({to:z.array(z.string().email().max(254)).min(1).max(10),cc:z.array(z.string().email().max(254)).max(10)}).strict().refine(v=>new Set([...v.to,...v.cc].map(a=>a.toLowerCase())).size===v.to.length+v.cc.length,"Remove duplicate recipients");
export const composedMailSchema=z.object({userId:z.string().uuid(),companyId:z.string().uuid(),recipients:recipientsSchema,subject:z.string().min(1).max(180).regex(/^[^\r\n]+$/),text:z.string().min(1).max(180000),attachments:z.array(financeAttachmentSchema).length(1),expires:z.number(),nonce:z.string().uuid()}).strict();
export type ComposedMail=z.infer<typeof composedMailSchema>;
export function signComposedMail(mail:ComposedMail,secret:string){
 const body=Buffer.from(JSON.stringify(composedMailSchema.parse(mail))).toString("base64url");
 return `${body}.${createHmac("sha256",secret).update("finance-compose:"+body).digest("base64url")}`;
}
export function verifyComposedMail(token:string,secret:string,userId:string,now=Date.now()){
 const [body,signature,...extra]=token.split(".");if(!body||!signature||extra.length)throw Error("Invalid email approval.");
 const expected=createHmac("sha256",secret).update("finance-compose:"+body).digest(),actual=Buffer.from(signature,"base64url");
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error("Email approval changed.");
 const mail=composedMailSchema.parse(JSON.parse(Buffer.from(body,"base64url").toString()));
 if(mail.userId!==userId||mail.expires<=now||mail.expires>now+15*60*1000)throw Error("Prepare the email again; approval expired.");
 return mail;
}
