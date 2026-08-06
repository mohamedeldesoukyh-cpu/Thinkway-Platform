import { getEmailFromAddress, getEmailReplyTo } from "@/lib/email/provider";

/** Shared Thinkway Media transactional email layout (platform documents). */

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailSummaryRow = {
  label: string;
  value: string;
};

export function renderEmailBrandMark(): string {
  return `<p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9CA3AF;">Thinkway Media</p>`;
}

export function renderEmailHeader(documentTitle: string): string {
  return `<tr>
  <td style="background:#0A0F1E;padding:20px 28px;">
    ${renderEmailBrandMark()}
    <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${escapeEmailHtml(documentTitle)}</p>
  </td>
</tr>`;
}

export function renderEmailSummaryTable(rows: EmailSummaryRow[]): string {
  if (rows.length === 0) return "";

  const body = rows
    .map((row, index) => {
      const isLast = index === rows.length - 1;
      const border = isLast ? "" : "border-bottom:1px solid #E5E7EB;";
      return `<tr>
  <td style="padding:14px 16px;${border}font-size:13px;color:#6B7280;width:140px;">${escapeEmailHtml(row.label)}</td>
  <td style="padding:14px 16px;${border}font-size:13px;font-weight:600;">${escapeEmailHtml(row.value)}</td>
</tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #E5E7EB;border-radius:8px;">
${body}
</table>`;
}

/** Prominent blue approval CTA + legal notice (platform IO emails). */
export function renderEmailApprovalCta(url: string, label: string): string {
  const safeUrl = escapeEmailHtml(url);
  const safeLabel = escapeEmailHtml(label);
  // Table + bulletproof button pattern — Outlook/Gmail keep the link clickable.
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 16px;">
  <tr>
    <td align="center" bgcolor="#0057FF" style="border-radius:8px;background:#0057FF;">
      <a href="${safeUrl}"
         target="_blank"
         rel="noopener noreferrer"
         style="display:inline-block;background:#0057FF;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:0.01em;font-family:Arial,Helvetica,sans-serif;">
        ${safeLabel}
      </a>
    </td>
  </tr>
</table>
<p style="margin:0 0 12px;font-size:13px;line-height:1.55;color:#374151;text-align:center;">
  Or open this link if the button is not clickable:<br>
  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#0057FF;word-break:break-all;">${safeUrl}</a>
</p>
<p style="margin:0 0 24px;font-size:12px;line-height:1.55;color:#6B7280;text-align:left;">
  By selecting Approve, you confirm that you have reviewed the attached document and agree to its contents, terms and conditions. Your electronic approval will be securely recorded for audit purposes.
</p>`;
}

/** @deprecated Prefer renderEmailApprovalCta for IO approval emails. */
export function renderEmailCtaButton(url: string, label: string): string {
  return renderEmailApprovalCta(url, label);
}

export function renderEmailTrafficSignature(): string {
  return `<p style="margin:0;font-size:14px;line-height:1.6;">
  Best regards,<br>
  <strong>Thinkway Media Traffic</strong><br>
  Traffic Operations<br>
  Thinkway Media
</p>`;
}

export function renderEmailFooter(documentKind: string): string {
  const fromEmail = getEmailFromAddress();
  const replyTo = getEmailReplyTo();
  return `<tr>
  <td style="padding:16px 28px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280;line-height:1.5;">
    Sent from ${escapeEmailHtml(fromEmail)} · Reply-To ${escapeEmailHtml(replyTo)}<br>
    © Thinkway Media — ${escapeEmailHtml(documentKind)}
  </td>
</tr>`;
}

/** Wrap document-specific body HTML in the shared branded shell. */
export function wrapThinkwayEmailDocument(input: {
  documentTitle: string;
  documentKind: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:Inter,Arial,sans-serif;color:#0A0F1E;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F7FA;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
          ${renderEmailHeader(input.documentTitle)}
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.6;">
              ${input.bodyHtml}
              ${renderEmailTrafficSignature()}
            </td>
          </tr>
          ${renderEmailFooter(input.documentKind)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Shared plain-text closing used by platform document emails. */
export function appendThinkwayEmailPlainTextFooter(lines: Array<string | null>): string {
  const fromEmail = getEmailFromAddress();
  const replyTo = getEmailReplyTo();
  return [
    ...lines,
    "",
    "Best regards,",
    "Thinkway Media Traffic",
    "Traffic Operations",
    "Thinkway Media",
    "",
    `Sent from ${fromEmail}`,
    `Reply-To: ${replyTo}`,
  ]
    .filter((line): line is string => line != null)
    .join("\n");
}
