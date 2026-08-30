import { NextResponse } from "next/server";

import { requestStoppedClientWorkspaceAccess } from "@/features/client-workspace/request-stopped-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const token = typeof (body as { token?: unknown })?.token === "string" ? (body as { token: string }).token : "";
  const reviewId =
    typeof (body as { reviewId?: unknown })?.reviewId === "string" ? (body as { reviewId: string }).reviewId : "";
  const name = typeof (body as { name?: unknown })?.name === "string" ? (body as { name: string }).name : "";
  const email = typeof (body as { email?: unknown })?.email === "string" ? (body as { email: string }).email : "";
  const note = typeof (body as { note?: unknown })?.note === "string" ? (body as { note: string }).note : "";

  if (token.trim().length < 16 || !reviewId.trim()) {
    return NextResponse.json(
      { ok: false, message: "This workspace link is invalid or has expired." },
      { status: 400 }
    );
  }

  const result = await requestStoppedClientWorkspaceAccess({
    token,
    reviewId,
    name,
    email,
    note,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, alreadyRequested: result.alreadyRequested === true });
}
