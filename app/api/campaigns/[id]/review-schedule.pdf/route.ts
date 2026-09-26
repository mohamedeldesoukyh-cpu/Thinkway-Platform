import { reviewScheduleResponse } from "@/features/client-workspace/review-schedule-response";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return reviewScheduleResponse(request, (await context.params).id, "pdf");
}
