import { Badge } from "@/components/ui/badge";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import { getGmailFromEmail, isGmailConfigured } from "@/lib/email/gmail-config";

export function EmailSettingsSection() {
  const configured = isGmailConfigured();
  const fromEmail = getGmailFromEmail();

  return (
    <OperationalFormSection
      title="Outbound email (Client IO)"
      description="Client IOs are sent from the Thinkway Gmail account so messages appear in Gmail Sent."
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Gmail connection</span>
          <Badge variant={configured ? "default" : "secondary"}>
            {configured ? "Configured" : "Not configured"}
          </Badge>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              From address
            </dt>
            <dd className="text-sm text-foreground">{fromEmail}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Provider
            </dt>
            <dd className="text-sm text-foreground">Gmail API (OAuth refresh token)</dd>
          </div>
        </dl>

        <div className="rounded-md border border-border/60 bg-muted/15 p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Setup (one-time)</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Create a Google Cloud project and enable the Gmail API.</li>
            <li>Create OAuth credentials (Web application) for Thinkway.</li>
            <li>Authorize <strong className="text-foreground">{fromEmail}</strong> and obtain a refresh token.</li>
            <li>
              Set environment variables on Vercel / local <code className="text-xs">.env.local</code>:
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>
                  <code>GMAIL_CLIENT_ID</code>
                </li>
                <li>
                  <code>GMAIL_CLIENT_SECRET</code>
                </li>
                <li>
                  <code>GMAIL_REFRESH_TOKEN</code>
                </li>
                <li>
                  <code>GMAIL_FROM_EMAIL</code> (optional, defaults to hello@thinkwaymedia.com)
                </li>
              </ul>
            </li>
          </ol>
          <p className="mt-3">
            Sent Client IO emails are logged in each campaign&apos;s Client IO tab under{" "}
            <strong className="text-foreground">Send history</strong>.
          </p>
        </div>
      </div>
    </OperationalFormSection>
  );
}
