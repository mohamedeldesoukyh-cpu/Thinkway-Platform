export type ClientIoApprovalContext = {
  id: string;
  campaign_name: string;
  client_name: string;
  status: "draft" | "sent" | "approved";
  terms_html: string | null;
  terms_text: string | null;
  attachment_url: string | null;
};

export type VendorIoApprovalContext = {
  id: string;
  campaign_name: string;
  influencer_name: string;
  amount: number;
  currency_code: string;
  status: "draft" | "sent" | "approved" | "rejected";
  terms_html: string | null;
  terms_text: string | null;
  attachment_url: string | null;
};

