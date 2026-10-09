import { PlatformIcon } from "@/lib/performance/platform-icon";
import { AB } from "@/lib/discovery/suite/helpers";
import { formatEngagementRate } from "@/features/discovery/components/creator-search/creator-search-utils";
import type { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";

/** Same metrics as Discovery, with the platform's shared image asset. */
export function ShortlistPlatformStats({ rows }: { rows: ReturnType<typeof buildDiscoveryCreatorViewModel>["platformStats"] }) {
  return <div className="sl-stats">
    <div className="sl-stats__h"><span /><span>Followers</span><span>Engagement</span><span>Avg views</span></div>
    {rows.length === 0 ? <div className="sl-stats__r"><span className="na" style={{ gridColumn: "1 / -1" }}>No metrics available</span></div> : rows.map(row => <div className="sl-stats__r" key={row.key}>
      {row.platform ? <PlatformIcon platform={row.platform} variant="logo" size="xs" className="!size-[15px]" /> : <span />}
      <b className={row.followers == null ? "na" : undefined}>{row.followers == null ? "not set" : AB(row.followers)}</b>
      <b className={row.engagement == null ? "na" : undefined}>{row.engagement == null ? "not set" : formatEngagementRate(row.engagement)}</b>
      <b className={row.avgViews == null ? "na" : undefined}>{row.avgViews == null ? "not set" : AB(row.avgViews)}</b>
    </div>)}
  </div>;
}
