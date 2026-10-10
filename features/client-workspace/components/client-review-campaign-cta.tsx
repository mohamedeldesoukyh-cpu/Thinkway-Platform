"use client";
import Link, { useLinkStatus } from "next/link";
function ReviewLabel({ label, entrance }: {
    label: string;
    entrance: boolean;
}) {
    const { pending } = useLinkStatus();
    return <><span role="status" aria-live="polite" aria-busy={pending}>{entrance ? label : pending ? 'Opening campaign…' : label}</span>{entrance && (pending ? <span className="tw-cta__spin" aria-hidden/> : <i aria-hidden>→</i>)}</>;
}
export function ClientReviewCampaignCta({ href, label = 'Review campaign', entrance = false }: {
    href: string;
    label?: string;
    entrance?: boolean;
}) {
    return <Link href={href} className={entrance ? 'tw-cta' : 'btn primary'} aria-label={label} data-client-entrance-cta={entrance || undefined} style={entrance ? undefined : { width: '100%', justifyContent: 'center', marginTop: 22, minHeight: 44 }}><ReviewLabel label={label} entrance={entrance}/></Link>;
}

