import type { ClientIoTerm } from "@/lib/io/client-io-terms";

/** Supplied UAE wording; Egypt retains its existing compliance clause. */
export const VENDOR_IO_COMPLIANCE_CLAUSES = {
  "EG": "The Influencer shall comply with all applicable laws of the Arab Republic of Egypt, including the Consumer Protection Law, the Cybercrime Law, and NTRA regulations governing digital advertising. The Influencer must clearly disclose paid partnerships in all posts (e.g., #Ad, #Sponsored, or platform-native tools). The Influencer shall not produce content that is misleading, deceptive, or makes unsubstantiated claims about any product or service.",
  "AE": "The Influencer shall comply with all applicable laws of the United Arab Emirates governing advertising, media and consumer protection, including UAE Federal Decree-Law No. 34 of 2021 on Combating Rumours and Cybercrimes and the applicable regulations of the UAE Media Council. The Influencer must clearly disclose paid partnerships in all posts (e.g., #Ad, #Sponsored, or platform-native disclosure tools) and shall not produce content that is misleading, deceptive, or makes unsubstantiated claims about any product or service."
} as const;

/** Platform terms; custom vendor and IO terms retain their existing precedence. */
export const VENDOR_IO_DEFAULT_TERMS: ClientIoTerm[] = [
  {
    "title": "Scope of Work & Performance Standards.",
    "body": "The Influencer shall adhere to all instructions issued by the Agency and/or the Client and shall deliver all content specified in the Deliverables table on the agreed dates and to the Client’s reasonable satisfaction. Content is subject to a maximum of three (3) rounds of revision per deliverable prior to final posting, with the Influencer submitting the preliminary version at least five (5) business days before the scheduled publishing date. The Influencer shall not publish any Produced Content without the Agency’s prior written approval."
  },
  {
    "title": "Usage Rights & License Grant.",
    "body": "The Influencer grants the Agency and the Client a license to use the Produced Content for digital marketing and advertising purposes for the duration set out under Usage Period in the Engagement section of this IO, effective from the date of first publication or first actual use of each deliverable, whichever is earlier. This license is limited to the Agency’s and the Client’s own digital channels and includes paid advertisements (Paid Ads) and unpublished/dark-post advertisements, provided that any Paid Ads use is confined to that same Usage Period and shall not extend beyond its expiry. This license does not transfer ownership of the Produced Content. Any use beyond the Usage Period or the channels stated above — additional channels, offline media, or an extended term — requires a separate written agreement and additional fees."
  },
  {
    "title": "Content Ownership & Intellectual Property.",
    "body": "The Influencer retains ownership of all intellectual property rights in the Produced Content, subject to the license granted under Clause 2. The Influencer warrants that the Produced Content is original, does not infringe any third-party rights, and shall disclose to the Agency any use of AI-generated tools in its production. The Influencer shall solely bear liability for any claim arising from a breach of this warranty."
  },
  {
    "title": "Risk Mitigation & Brand Safety.",
    "body": "The Influencer shall ensure all Produced Content is brand-safe and free from offensive, harmful, defamatory, or discriminatory material. In the event of a brand safety breach, the Influencer shall remove the offending content within 24 hours of written notice, failing which a full refund of all amounts received shall apply. The Agency reserves the right to request content removal at any time without liability."
  },
  {
    "title": "Payment & Secure Payment System.",
    "body": "Payment shall be made in accordance with the Schedule stated above, via verified bank transfer to the account details provided herein. The Agency shall not be liable for delays resulting from incomplete or inaccurate bank details provided by the Influencer."
  },
  {
    "title": "Compliance with Local Laws & Ethical Behavior.",
    "body": "The Influencer shall comply with all applicable laws of the Arab Republic of Egypt, including the Consumer Protection Law, the Cybercrime Law, and NTRA regulations governing digital advertising. The Influencer must clearly disclose paid partnerships in all posts (e.g., #Ad, #Sponsored, or platform-native tools). The Influencer shall not produce content that is misleading, deceptive, or makes unsubstantiated claims about any product or service."
  },
  {
    "title": "Ethical Conduct.",
    "body": "The Influencer shall conduct themselves professionally and shall not engage in, promote, or facilitate hate speech, harassment, violence, or discrimination. Neither Party shall make disparaging statements about the other Party, its affiliates, employees, or clients during or after the term of this IO."
  },
  {
    "title": "Confidentiality.",
    "body": "The Influencer shall keep confidential the pricing, deal terms, creative briefs, and any unreleased content or Client information shared in connection with this IO, both during its term and after its expiry or termination."
  },
  {
    "title": "Exclusivity.",
    "body": "Unless expressly stated on the front page of this IO, this engagement is non-exclusive and the Agency may appoint other influencers for the same Product(s) or campaign. Where exclusivity is expressly agreed on the front page, it shall be limited to directly competing products within the same category, for the campaign period stated in this IO, and any breach shall entitle the Agency to recover actual damages demonstrably suffered as a result."
  },
  {
    "title": "Termination.",
    "body": "Either Party may terminate this IO by written notice if the other Party breaches a material obligation and fails to remedy it within seven (7) days of written notice. The Agency may also terminate this IO for convenience at any time prior to final content delivery by written notice, in which case the Influencer shall be entitled to payment for work actually performed up to the termination date."
  },
  {
    "title": "Force Majeure.",
    "body": "Neither Party shall be liable for any delay or failure to perform its obligations under this IO where such delay or failure results from causes beyond its reasonable control, including natural disasters, government action, internet or platform outages, or other events of force majeure."
  },
  {
    "title": "Limitation of Liability.",
    "body": "The maximum aggregate liability of the Agency under this IO shall be limited to the total amounts paid or payable to the Influencer hereunder."
  },
  {
    "title": "Governing Law & Jurisdiction.",
    "body": "This IO shall be governed by and interpreted in accordance with the laws of the Arab Republic of Egypt. Any disputes shall be subject to the exclusive jurisdiction of the competent courts of Cairo, Egypt"
  }
];
