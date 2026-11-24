import { verifyFinanceMailEvent } from "@/features/finance-assistant/mail-events";
import { enqueueFinanceEmail } from "@/features/finance-assistant/mail-worker";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
  const secret=process.env.FINANCE_MAIL_WEBHOOK_SECRET;
  if(!secret)return Response.json({error:"Not configured"},{status:503});
  const length=Number(request.headers.get("content-length")??0);
  if(length>128000)return new Response(null,{status:413});
  const body=await request.text();if(Buffer.byteLength(body)>128000)return new Response(null,{status:413});
  let event;try{event=verifyFinanceMailEvent(body,request.headers,secret);}catch{return new Response(null,{status:401});}
  if(!event)return Response.json({accepted:true});
  try{return Response.json(await enqueueFinanceEmail(event.threadId,event.emailId));}
  catch{return Response.json({error:"Retry later"},{status:503});}
}
