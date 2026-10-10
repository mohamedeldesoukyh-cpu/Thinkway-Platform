import { CLIENT_STATUS_LABEL, type ClientWorkspaceSectionId } from "../constants";
import { buildClientReviewPath } from "../security/review-token";
import type { ClientWorkspaceEntry } from "../types";
import { ENTRANCE_COPY, distinctNextStep } from "../entrance-presentation";
import { ClientReviewCampaignCta } from "./client-review-campaign-cta";
import { EntranceMark, EntranceGate } from "./client-entrance-frame";
function Identity({ entry, card = false }: {
    entry: ClientWorkspaceEntry;
    card?: boolean;
}) {
    const partner = entry.identityLogo;
    const hasPartner = Boolean(partner?.url || partner?.alt);
    return <div className={card ? 'tw-cobrand' : 'tw-lock'}>{card && <span className="tw-cobrand__k">{hasPartner ? 'Presented by Thinkway with' : 'Presented by'}</span>}<EntranceMark /><span className="tw-word">THINK<em>WAY</em></span>{hasPartner && <><span className={card ? 'tw-cobrand__rule' : 'tw-lock__sep'}/><span>{partner?.url ? <span className="tw-partner">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={partner.url} alt={partner.alt}/></span> : <span className="tw-partner tw-partner--text">{partner?.alt}</span>}</span></>}</div>;
}
export function ClientReviewEntry({ entry, reviewId, token, landingSection = 'shortlist' }: {
    entry: ClientWorkspaceEntry;
    reviewId: string;
    token: string;
    landingSection?: ClientWorkspaceSectionId;
}) {
    const copy = ENTRANCE_COPY[entry.entranceState ?? 'awaiting'];
    const status = entry.statusLabel || CLIENT_STATUS_LABEL[entry.status];
    const date = entry.lastUpdated ? new Date(entry.lastUpdated) : null;
    const updated = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(date) : null;
    return <div className="tw-stage" data-entry-ready="welcome"><section className="tw-welcome"><div className="tw-ed"><span className="tw-ed__k"><s />Your campaign workspace</span><h1>{copy.before}<b>{copy.accent}</b>{copy.after}</h1><p>{copy.body}</p><div className="tw-ed__meta"><span>Prepared by Thinkway</span>{entry.brandName && <><s /><span>{entry.brandName}</span></>}</div></div><div className="tw-card"><div className="tw-card__bd"><Identity entry={entry} card/><div className="tw-card__k">Your campaign workspace</div>{entry.brandName && <div className="tw-card__brand">{entry.brandName}</div>}<h2 className="tw-card__t" dir="auto">{entry.campaignName}</h2>{entry.clientLabel && <div className="tw-card__for">Prepared for {entry.clientLabel}</div>}</div><div className="tw-card__div"/><div className="tw-card__bd">{entry.entranceBanner && <div className="tw-flag tw-flag--wrn">{entry.entranceBanner === 'historical' ? "You’re viewing a previous version." : 'An updated quotation is available.'}</div>}<div className={`tw-st tw-st--${copy.tone}`}><span className="tw-st__dot"/><span className="tw-st__t"><b>Status</b><span>{status}</span>{distinctNextStep(status, entry.actionRequired) && <span className="tw-st__next"><b>What happens next</b><span>{entry.actionRequired}</span></span>}</span></div><div className="tw-card__foot">{updated && <span>Updated {updated}</span>}{updated && Boolean(entry.reviewNumber) && <s />}{Boolean(entry.reviewNumber) && <span>Review {entry.reviewNumber}</span>}</div><ClientReviewCampaignCta href={buildClientReviewPath(reviewId, token, landingSection)} label={copy.cta} entrance/><p className="tw-note">Opening your workspace does not submit an approval.</p></div></div></section></div>;
}
export function InvalidReviewLink({ message }: {
    message?: string;
}) {
    return <EntranceGate title="This review link is not available"><p>{message ?? 'The link may have been revoked or is for a different campaign.'}</p></EntranceGate>;
}
