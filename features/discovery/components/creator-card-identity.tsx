import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";

export function CreatorCardIdentity({ vm, onOpen }: {
  vm: ReturnType<typeof buildDiscoveryCreatorViewModel>;
  onOpen?: () => void;
}) {
  return <div className="creator-card-identity">
    <CreatorAvatarImage avatarUrl={vm.avatarUrl} profileUrl={vm.profileUrl} alt={vm.displayName} sizeClassName="size-12" className="border-0" />
    <div className="min-w-0">
      <div className="creator-card-identity__name">
        {onOpen ? <button type="button" title={vm.displayName} onClick={event => { event.stopPropagation(); onOpen(); }}>{vm.displayName}</button> : <span title={vm.displayName}>{vm.displayName}</span>}
        <small title="Thinkway score">★ {vm.thinkwayStarLabel}</small>
      </div>
      <div className="creator-card-identity__meta">
        {vm.handleLabel ? <span title={vm.handleLabel}>{vm.handleLabel}</span> : null}
        {vm.countryFlagCodes.length ? <CountryFlagsStack countryCodes={vm.countryFlagCodes} size="sm" overlay={false} /> : null}
        {vm.countryLabel !== "—" ? <span title={vm.countryLabel}>{vm.countryLabel}</span> : null}
      </div>
    </div>
  </div>;
}

export function CreatorCardStatsHeader() {
  return <div className="creator-card-stats-heading" aria-hidden="true"><span /><span>Followers</span><span>Engagement</span><span>Avg views</span></div>;
}
