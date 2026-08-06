import { Badge } from "@/components/ui/badge";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import { isGmailConfigured } from "@/lib/email/gmail-config";
import {
  getEmailFromAddress,
  getEmailProvider,
  getOutboundEmailRuntimeStatus,
} from "@/lib/email/provider";

function providerLabel(provider: "resend" | "gmail"): string {
  return provider === "resend" ? "Resend" : "Gmail API (OAuth)";
}

export function EmailSettingsSection() {
  const status = getOutboundEmailRuntimeStatus();
  const activeProvider = getEmailProvider();
  const fromEmail = getEmailFromAddress();
  const gmailOptionalConfigured = isGmailConfigured();

  return (
    <div className="grid gap-6">
      <OperationalFormSection
        title="Outbound email (Client IO / Vendor IO)"
        description="Platform IO mail uses a single outbound provider. Resend is the active Production/Development transport. Gmail OAuth is optional and never required for IO send."
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Send readiness</span>
            <Badge variant={status.sendReady ? "default" : "destructive"}>
              {status.sendReady ? "Ready to send" : "Not ready"}
            </Badge>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Active provider
              </dt>
              <dd className="text-sm text-foreground">{providerLabel(activeProvider)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                EMAIL_PROVIDER env
              </dt>
              <dd className="text-sm text-foreground">
                {status.envProvider ? (
                  <code className="text-xs">{status.envProvider}</code>
                ) : (
                  <span className="text-muted-foreground">unset (resolved via runtime rules)</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                From address
              </dt>
              <dd className="text-sm text-foreground">{fromEmail}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Reply-To
              </dt>
              <dd className="text-sm text-foreground">{status.replyTo}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Resend API key
              </dt>
              <dd className="text-sm text-foreground">
                {status.resendConfigured ? "Configured" : "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Gmail OAuth (optional)
              </dt>
              <dd className="text-sm text-foreground">
                {gmailOptionalConfigured ? "Configured" : "Not configured"}
              </dd>
            </div>
          </dl>

          {!status.sendReady && status.sendBlockedReason ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {status.sendBlockedReason}
            </p>
          ) : null}

          <div className="rounded-md border border-border/60 bg-muted/15 p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Runtime selection</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              <li>
                <code>EMAIL_PROVIDER=resend</code> → Resend (required for IO send on Production /
                Development)
              </li>
              <li>
                <code>EMAIL_PROVIDER=gmail</code> → Gmail OAuth (optional mailbox features only)
              </li>
              <li>
                Unset / empty → Resend when <code>RESEND_API_KEY</code> is present; otherwise Gmail
                only if OAuth is configured; otherwise Resend
              </li>
            </ul>
            <p className="mt-3">
              Client IO and Vendor IO delivery is logged under each campaign&apos;s{" "}
              <strong className="text-foreground">Send history</strong>. Resend does not write to a
              Gmail Sent folder.
            </p>
          </div>
        </div>
      </OperationalFormSection>

      <OperationalFormSection
        title="Gmail OAuth (optional)"
        description="Reserved for future mailbox features. Not used for Client IO / Vendor IO when Resend is active."
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Gmail connection</span>
          <Badge variant={gmailOptionalConfigured ? "default" : "secondary"}>
            {gmailOptionalConfigured ? "Configured" : "Not configured"}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Setting Gmail OAuth credentials does not change IO send while{" "}
          <code className="text-xs">EMAIL_PROVIDER=resend</code> (or Resend is selected by the
          unset/empty resolution rules above).
        </p>
      </OperationalFormSection>
    </div>
  );
}
