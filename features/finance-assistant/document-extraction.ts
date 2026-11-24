import {z} from "zod";
const amount=z.string().regex(/^-?\d{1,14}(\.\d{1,2})?$/);
export const extractedStatementSchema=z.object({currency:z.string().regex(/^[A-Z]{3}$/),from:z.string().date(),to:z.string().date(),opening:amount,closing:amount,complete:z.boolean(),warnings:z.array(z.string().max(500)).max(20),rows:z.array(z.object({date:z.string().date(),reference:z.string().max(120),description:z.string().max(500),amount,source:z.string().min(1).max(120)}).strict()).min(1).max(500)}).strict();
export function statementCsv(statement:z.infer<typeof extractedStatementSchema>){
 const quote=(v:string)=>'"'+v.replaceAll('"','""')+'"';
 return "date,reference,description,amount\n"+statement.rows.map(r=>[r.date,r.reference,r.description,r.amount].map(quote).join(",")).join("\n");
}
export function documentInput(bytes:Buffer,mime:string){
 if(bytes.length===0||bytes.length>3_000_000)throw Error("Upload a document under 3 MB.");
 if(mime==="application/pdf"&&bytes.subarray(0,5).toString()==="%PDF-")return {type:"input_file",filename:"statement.pdf",file_data:`data:application/pdf;base64,${bytes.toString("base64")}`};
 if(mime==="image/png"&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||mime==="image/jpeg"&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {type:"input_image",image_url:`data:${mime};base64,${bytes.toString("base64")}`};
 throw Error("Use a valid PDF, PNG or JPEG document.");
}
