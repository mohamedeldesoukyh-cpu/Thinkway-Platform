import {
  appendThinkwayEmailPlainTextFooter,
  escapeEmailHtml,
  wrapThinkwayEmailDocument,
} from "@/lib/email/layout";

export function buildCreatorWorkspaceInviteEmail(input: {
  activateUrl: string;
}): { subject: string; html: string; plainText: string } {
  const subject = "You've been invited to Thinkway Creator Workspace";
  const safeUrl = escapeEmailHtml(input.activateUrl);
  const html = wrapThinkwayEmailDocument({
    documentTitle: "Creator Workspace",
    documentKind: "Creator Workspace",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello,</p>
      <p style="margin:0 0 16px;">You've been invited to Thinkway Creator Workspace.</p>
      <p style="margin:0 0 16px;">Thinkway has invited you to manage your campaigns, deliverables and payments in one workspace.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 16px;">
        <tr>
          <td align="center" bgcolor="#0057FF" style="border-radius:8px;background:#0057FF;">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0057FF;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">Activate Creator Workspace</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6B7280;">Or open this link:<br><a href="${safeUrl}" style="color:#0057FF;word-break:break-all;">${safeUrl}</a></p>
      <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">This invitation expires in 24 hours and can only be used once.</p>
    `,
  });
  const plainText = appendThinkwayEmailPlainTextFooter([
    "Hello,",
    "",
    "You've been invited to Thinkway Creator Workspace.",
    "",
    "Thinkway has invited you to manage your campaigns, deliverables and payments in one workspace.",
    "",
    `Activate Creator Workspace: ${input.activateUrl}`,
    "",
    "This invitation expires in 24 hours and can only be used once.",
  ]);
  return { subject, html, plainText };
}
