import { money, type PaymentRow } from './model';

export type PaymentUnit = { id: string; label: string; live: boolean };
type Deliverable = { id:string; campaign_line_id:string; quantity:number; sort_order:number; deliverable_type:string; created_at:string };
type Post = { id:string; assignment_deliverable_id:string; sequence_number:number; status:string };
type Publication = { id:string; assignment_deliverable_id:string|null; assignment_post_schedule_id:string|null; status:string };
type Link = { assignment_deliverable_id:string; assignment_post_schedule_id:string|null; publication_id:string };
const liveStatuses = new Set(['published','live','posted','verified']);

export function paymentUnits(deliverables: Deliverable[], posts: Post[], publications: Publication[], links: Link[]): PaymentUnit[] {
    const live = publications.filter(p => liveStatuses.has(p.status.toLowerCase()));
    const references = [...live, ...links.filter(l => live.some(p => p.id === l.publication_id))];
    return [...deliverables].sort((a,b) => a.sort_order-b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).flatMap(d => {
        const quantity = Math.max(1, d.quantity);
        return Array.from({length:quantity},(_,index) => {
            const post = posts.find(p => p.assignment_deliverable_id === d.id && p.sequence_number === index+1);
            // An unlinked publication on a multi-unit row proves only one unit, not every unit.
            const published = references.some(p => p.assignment_post_schedule_id
                ? p.assignment_post_schedule_id === post?.id
                : p.assignment_deliverable_id === d.id && index === 0);
            return {id:post?.id ?? `${d.id}:${index+1}`, label:`${d.deliverable_type.replaceAll('_',' ')}${quantity>1 ? ` ${index+1}` : ''}`, live:post?.status !== 'cancelled' && (published || !!post && liveStatuses.has(post.status.toLowerCase()))};
        });
    });
}

export function paymentAllocation(row: Pick<PaymentRow,'fee'|'vat'|'paid'|'units'>) {
    const total = money(row.fee + money(row.fee*row.vat/100));
    const units = row.units ?? [];
    const cents = Math.round(total*100);
    const base = units.length ? Math.floor(cents/units.length) : 0;
    const shares = units.map((unit,index) => ({...unit, value:(base+(index<cents%units.length?1:0))/100, allocated:0, actual:0, advance:0}));
    let balance = money(row.paid);
    // Settle the oldest live obligations first, then reserve the remaining payment
    // against future units in their original order. Recomputed when units go live.
    for (const unit of [...shares.filter(u=>u.live), ...shares.filter(u=>!u.live)]) {
        unit.allocated = money(Math.min(unit.value,Math.max(0,balance)));
        unit.actual = unit.live ? unit.allocated : 0;
        unit.advance = unit.live ? 0 : unit.allocated;
        balance = money(balance-unit.allocated);
    }
    const earned = money(shares.filter(u=>u.live).reduce((sum,u)=>sum+u.value,0));
    const advance = money(Math.max(0,row.paid-earned));
    return {total, earned, actual:money(Math.min(row.paid,earned)), advance, remaining:money(Math.max(0,total-row.paid)), units:shares,
        live:units.filter(u=>u.live).length, count:units.length, fullyPaid:units.length>0 && units.every(u=>u.live) && row.paid>=total};
}
