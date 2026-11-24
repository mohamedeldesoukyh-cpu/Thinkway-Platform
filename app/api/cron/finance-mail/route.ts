import { processFinanceMailCycle } from "@/features/finance-assistant/mail-preparation";
import { timingSafeEqual } from "node:crypto";
import { runFinanceMailWorker,sendPreparedFinanceMail } from "@/features/finance-assistant/mail-worker";
export const runtime="nodejs";
export const maxDuration=120;
export const dynamic="force-dynamic";
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  const provided=Buffer.from(request.headers.get("authorization")??"");const expected=Buffer.from(`Bearer ${secret}`);
  if(!secret||provided.length!==expected.length||!timingSafeEqual(provided,expected))return new Response(null,{status:401});
  try{return Response.json(await processFinanceMailCycle(runFinanceMailWorker,sendPreparedFinanceMail));}
  catch{return Response.json({error:"Finance mail worker unavailable"},{status:503});}
}
