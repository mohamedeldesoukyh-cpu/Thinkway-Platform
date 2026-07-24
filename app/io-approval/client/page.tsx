import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SafeHtml } from "@/components/security/safe-html";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { debugIo } from "@/features/io/queries";
import type { ClientIoApprovalContext } from "@/types/io-approval";

type Props = {
  searchParams: Promise<{
    token?: string;
    approved?: string;
    error?: string;
  }>;
};

export default async function ClientIoApprovalPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  const approved = params.approved === "1";
  const error = params.error ?? "";

  const supabase = await createSupabaseServerClient();
  let context: ClientIoApprovalContext | null = null;

  if (token) {
    const { data } = await (supabase as any).rpc(
      "get_client_io_approval_context",
      { p_token: token }
    );
    context =
      ((Array.isArray(data) ? data[0] : data) as ClientIoApprovalContext | null) ??
      null;
  }

  async function approveAction(formData: FormData) {
    "use server";

    const token = String(formData.get("token") ?? "");
    const approvedBy = String(formData.get("approved_by_name") ?? "").trim();
    const supabase = await createSupabaseServerClient();

    if (!token || !approvedBy) {
      redirect("/io-approval/client?error=Name%20and%20token%20are%20required.");
    }

    const { error } = await (supabase as any).rpc("approve_client_io_by_token", {
      p_token: token,
      p_approved_by_name: approvedBy,
      p_approval_ip: null,
    });

    if (error) {
      debugIo("io-approval", "client approval failed", { message: error.message });
      const msg = encodeURIComponent(error.message);
      const t = encodeURIComponent(token);
      redirect(`/io-approval/client?token=${t}&error=${msg}`);
    }

    debugIo("io-approval", "client approved", { token: "redacted" });
    const t = encodeURIComponent(token);
    redirect(`/io-approval/client?token=${t}&approved=1`);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Client IO Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {approved ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              Client IO approved successfully.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {context ? (
            <>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Campaign:</span>{" "}
                  {context.campaign_name}
                </p>
                <p>
                  <span className="text-muted-foreground">Client:</span>{" "}
                  {context.client_name}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  {context.status}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 text-sm">
                {context.terms_html ? (
                  <SafeHtml html={context.terms_html} />
                ) : (
                  <p className="whitespace-pre-wrap">
                    {context.terms_text ?? "No terms provided."}
                  </p>
                )}
              </div>

              {context.attachment_url ? (
                <a
                  href={context.attachment_url}
                  className="text-sm underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  View attachment
                </a>
              ) : null}

              <form action={approveAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="token" value={token} />
                <input
                  type="text"
                  name="approved_by_name"
                  placeholder="Your full name"
                  required
                  className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
                />
                <Button type="submit">Approve IO</Button>
              </form>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Approval link is invalid or expired.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}