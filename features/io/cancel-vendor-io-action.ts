"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function cancelVendorIoAction(input: {campaignId:string;ioId:string;reason:string}) {
 const parsed=z.object({campaignId:z.string().uuid(),ioId:z.string().uuid(),reason:z.string().trim().min(3).max(2000)}).safeParse(input);
 if(!parsed.success)return {ok:false,message:"Choose an IO and enter a cancellation reason."};
 const db=await createSupabaseServerClient();
 const {error}=await db.rpc("cancel_vendor_io_preserving_history" as never,{p_campaign_id:parsed.data.campaignId,p_io_id:parsed.data.ioId,p_reason:parsed.data.reason} as never);
 if(error)return {ok:false,message:error.message};
 revalidatePath('/campaigns/'+parsed.data.campaignId);revalidatePath('/ios/vendor');revalidatePath('/billing');
 return {ok:true,message:"Vendor IO cancelled. Its document and history are preserved. No notification was sent."};
}
