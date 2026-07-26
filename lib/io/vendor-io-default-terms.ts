import type { ClientIoTerm } from "@/lib/io/client-io-terms";

/**
 * Platform default Vendor IO terms (Section 8) — synced with Thinkway_IO_Global.html.
 * NULL on influencers.vendor_io_terms_text means "use these platform defaults".
 */
export const VENDOR_IO_DEFAULT_TERMS: ClientIoTerm[] = [
  {
    title: "Scope of Work & Performance Standards.",
    body: "The Influencer shall adhere to all instructions made by the Agency and/or the Client. The Influencer commits to delivering all content as specified in the Content Deliverables table, on the agreed dates, and to the Client's satisfaction. Content is subject to a maximum of two (2) revision rounds prior to final posting. The Influencer shall not publish any Produced Content without prior written approval from the Agency.",
  },
  {
    title: "Risk Mitigation & Brand Safety.",
    body: "The Influencer shall ensure all Produced Content is brand-safe and free from offensive, harmful, defamatory, or discriminatory material. In the event of a brand safety breach, the Influencer shall remove the offending content within 24 hours of written notice, failing which a full refund of all amounts received shall apply. The Agency reserves the right to request content removal at any time without liability.",
  },
  {
    title: "Payment & Secure Payment System.",
    body: "All payments shall be made via verified bank transfer to the account details provided herein. Thinkway operates a secure and auditable disbursement system through Arab African International Bank (AAIB), ensuring full traceability and compliance with applicable Egyptian financial regulations. The Agency shall not be liable for delays resulting from incomplete or inaccurate bank details provided by the Influencer.",
  },
  {
    title: "Compliance with Local Laws & Ethical Behavior.",
    body: "The Influencer shall comply with all applicable laws of the Arab Republic of Egypt, including the Consumer Protection Law, the Cybercrime Law, and NTRA regulations governing digital advertising. The Influencer must clearly disclose paid partnerships in all posts (e.g., #Ad, #Sponsored, or platform-native tools). The Influencer shall not produce content that is misleading, deceptive, or makes unsubstantiated claims about any product or service.",
  },
  {
    title: "Ethical Conduct.",
    body: "The Influencer shall conduct themselves professionally and shall not engage in, promote, or facilitate hate speech, harassment, violence, or discrimination. Both Parties agree not to make disparaging statements about the other Party, its affiliates, employees, or clients during or after the term of this IO.",
  },
  {
    title: "Intellectual Property.",
    body: "The Influencer warrants that all elements of the Produced Content are either wholly original or properly licensed in accordance with applicable intellectual property laws and platform guidelines. The Influencer shall not include material that infringes upon the copyright, trademark, or other rights of any third party.",
  },
  {
    title: "Exclusivity & Confidentiality.",
    body: "The Influencer agrees to work exclusively with the Agency on this campaign and not to engage directly or indirectly with the same campaign during the campaign period and for one (1) month thereafter. Any breach shall result in liquidated damages of the EGP equivalent of USD 10,000. All pricing and deal terms shall remain strictly confidential.",
  },
  {
    title: "Limitation of Liability.",
    body: "The maximum aggregate liability of the Agency under this IO shall be limited to the total amounts paid hereunder or the EGP equivalent of USD 2,000, whichever is lower.",
  },
  {
    title: "Governing Law & Jurisdiction.",
    body: "This IO shall be governed by and interpreted in accordance with the laws of the Arab Republic of Egypt. Any disputes shall be subject to the exclusive jurisdiction of the competent courts of Cairo, Egypt.",
  },
];
