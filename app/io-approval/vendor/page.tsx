import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { debugIo } from "@/features/io/queries";
import type { VendorIoApprovalContext } from "@/types/io-approval";

type Props = {
  searchParams: Promise<{
    token?: string;
    approved?: string;
    rejected?: string;
    error?: string;
  }>;
};

export default async function VendorIoApprovalPage({
  searchParams,
}: Props) {
  const params = await searchParams;

  const token = params.token?.trim() ?? "";
  const approved = params.approved === "1";
  const rejected = params.rejected === "1";
  const error = params.error ?? "";

  const supabase = await createSupabaseServerClient();

  let context: VendorIoApprovalContext | null = null;

  if (token) {
    const { data } = await (supabase as any).rpc(
      "get_vendor_io_approval_context",
      { p_token: token }
    );

    context =
      ((Array.isArray(data) ? data[0] : data) as VendorIoApprovalContext | null) ??
      null;
  }

  async function approveAction(formData: FormData) {
    "use server";

    const token = String(formData.get("token") ?? "");
    const approvedBy = String(
      formData.get("approved_by_name") ?? ""
    ).trim();

    const supabase = await createSupabaseServerClient();

    if (!token || !approvedBy) {
      redirect("/io-approval/vendor?error=Name%20and%20token%20are%20required.");
    }

    const { error } = await (supabase as any).rpc(
      "approve_vendor_io_by_token",
      {
        p_token: token,
        p_approved_by_name: approvedBy,
        p_approval_ip: null,
      }
    );

    if (error) {
      debugIo("io-approval", "vendor approval failed", {
        message: error.message,
      });
      const msg = encodeURIComponent(error.message);
      const t = encodeURIComponent(token);
      redirect(`/io-approval/vendor?token=${t}&error=${msg}`);
    }

    debugIo("io-approval", "vendor approved", {
      token: "redacted",
    });

    const t = encodeURIComponent(token);
    redirect(`/io-approval/vendor?token=${t}&approved=1`);
  }

  async function rejectAction(formData: FormData) {
    "use server";

    const token = String(formData.get("token") ?? "");
    const approvedBy = String(
      formData.get("approved_by_name") ?? ""
    ).trim();

    const reason = String(
      formData.get("rejection_reason") ?? ""
    ).trim();

    const supabase = await createSupabaseServerClient();

    if (!token || !approvedBy) {
      redirect("/io-approval/vendor?error=Name%20and%20token%20are%20required.");
    }

    const { error } = await (supabase as any).rpc(
      "reject_vendor_io_by_token",
      {
        p_token: token,
        p_approved_by_name: approvedBy,
        p_rejection_reason: reason || null,
        p_approval_ip: null,
      }
    );

    if (error) {
      debugIo("io-approval", "vendor rejection failed", {
        message: error.message,
      });
      const msg = encodeURIComponent(error.message);
      const t = encodeURIComponent(token);
      redirect(`/io-approval/vendor?token=${t}&error=${msg}`);
    }

    debugIo("io-approval", "vendor rejected", {
      token: "redacted",
    });

    const t = encodeURIComponent(token);
    redirect(`/io-approval/vendor?token=${t}&rejected=1`);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Vendor IO Approval</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {approved ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              Vendor IO approved successfully.
            </div>
          ) : null}

          {rejected ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              Vendor IO rejected.
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
                  <span className="text-muted-foreground">
                    Campaign:
                  </span>{" "}
                  {context.campaign_name}
                </p>

                <p>
                  <span className="text-muted-foreground">
                    Creator:
                  </span>{" "}
                  {context.influencer_name}
                </p>

                <p>
                  <span className="text-muted-foreground">
                    Status:
                  </span>{" "}
                  {context.status}
                </p>

                <p>
                  <span className="text-muted-foreground">
                    Amount:
                  </span>{" "}
                  {context.amount}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 text-sm">
                {context.terms_html ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: context.terms_html,
                    }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">
                    {context.terms_text ?? "No terms provided."}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <form
                  action={approveAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="token" value={token} />

                  <input
                    type="text"
                    name="approved_by_name"
                    placeholder="Your full name"
                    required
                    className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
                  />

                  <Button type="submit">
                    Approve IO
                  </Button>
                </form>

                <form
                  action={rejectAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="token" value={token} />

                  <input
                    type="text"
                    name="approved_by_name"
                    placeholder="Your full name"
                    required
                    className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
                  />

                  <input
                    type="text"
                    name="rejection_reason"
                    placeholder="Rejection reason (optional)"
                    className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
                  />

                  <Button
                    type="submit"
                    variant="outline"
                  >
                    Reject IO
                  </Button>
                </form>
              </div>
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