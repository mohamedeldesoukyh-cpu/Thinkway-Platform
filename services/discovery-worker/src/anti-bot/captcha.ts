export type CaptchaSignal = {
  detected: boolean;
  reason?: string;
};

const CAPTCHA_MARKERS = [
  "captcha",
  "challenge-platform",
  "cf-challenge",
  "verify you are human",
  "unusual traffic",
  "robot",
];

export function detectCaptcha(html: string, title?: string): CaptchaSignal {
  const haystack = `${title ?? ""} ${html}`.toLowerCase();
  const hit = CAPTCHA_MARKERS.find((marker) => haystack.includes(marker));
  return hit ? { detected: true, reason: hit } : { detected: false };
}
