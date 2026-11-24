import { accountingContext } from "@/features/accounting/setup-server";
import { isFinanceOwner } from "@/features/finance-assistant/approval-policy";
import { POST as applyAccountingCorrection } from "@/app/api/accounting/media-posting/route";
import { assertCsrfRequest } from "@/lib/security/csrf";
export async function POST(request:Request){
  if(!assertCsrfRequest(request).ok)return Response.json({error:"Invalid origin"},{status:403});
  try{const ctx=await accountingContext();if(!isFinanceOwner(ctx.user.email))throw Error();}
  catch{return Response.json({error:"Only mohamedeldesouky@thinkwaymedia.com may approve Amgad accounting corrections."},{status:403});}
  // Existing MFA, finance.write, source token/version and DB approval checks apply.
  return applyAccountingCorrection(request);
}
