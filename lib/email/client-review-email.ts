import {
  appendThinkwayEmailPlainTextFooter,
  escapeEmailHtml,
  wrapThinkwayEmailDocument,
} from "@/lib/email/layout";

export function buildClientReviewEmail(input: {
  clientLabel: string;
  brandName: string;
  campaignName: string;
  reviewUrl: string;
  updates?: string[];
}): { subject: string; html: string; plainText: string } {
  const isUpdate = Boolean(input.updates?.length);
  const subject = isUpdate
    ? `Updated proposal — ${input.campaignName}`
    : `Campaign proposal — ${input.campaignName}`;
  const intro = isUpdate
    ? `An updated campaign proposal is ready for ${escapeEmailHtml(input.brandName)}.`
    : `A campaign proposal is ready for ${escapeEmailHtml(input.brandName)}.`;
  const updateHtml =
    input.updates && input.updates.length > 0
      ? `<p style="margin:16px 0 8px;font-weight:600;">What changed</p><ul style="margin:0 0 16px;padding-left:18px;">${input.updates
          .map((item) => `<li>${escapeEmailHtml(item)}</li>`)
          .join("")}</ul>`
      : "";
  const safeUrl = escapeEmailHtml(input.reviewUrl);
  const html = wrapThinkwayEmailDocument({
    documentTitle: isUpdate ? "Updated campaign proposal" : "Campaign proposal",
    documentKind: "Client Workspace",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello,</p>
      <p style="margin:0 0 16px;">${intro}</p>
      ${updateHtml}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 16px;">
        <tr>
          <td align="center" bgcolor="#0057FF" style="border-radius:8px;background:#0057FF;">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0057FF;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;">Open proposal</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6B7280;">Or open this link:<br><a href="${safeUrl}" style="color:#0057FF;word-break:break-all;">${safeUrl}</a></p>
      <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">No Thinkway login is required.</p>
    `,
  });
  const plainText = appendThinkwayEmailPlainTextFooter([
    "Hello,",
    "",
    isUpdate
      ? `An updated campaign proposal is ready for ${input.brandName}.`
      : `A campaign proposal is ready for ${input.brandName}.`,
    ...(input.updates?.length ? ["", "What changed:", ...input.updates.map((item) => `- ${item}`)] : []),
    "",
    `Open proposal: ${input.reviewUrl}`,
  ]);
  return { subject, html, plainText };
}

