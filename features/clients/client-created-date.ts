const cairoDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Africa/Cairo", month: "short", day: "numeric", year: "numeric",
});

/** Match server and browser rendering, including timestamps near midnight. */
export function formatClientCreatedDate(timestamp: string): string {
  return cairoDate.format(new Date(timestamp));
}
