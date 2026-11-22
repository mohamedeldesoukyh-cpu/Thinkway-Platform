export type DeliveryPublication = {
  id: string; campaign_line_id: string | null; platform: string; publication_type: string;
  content_url: string | null; status: string;
  assignment_deliverable_id?: string | null; assignment_post_schedule_id?: string | null;
};
type RequiredDelivery = { id?: string; platform?: string; deliverable_type?: string; quantity: number; posts: { id?: string }[] };
const key = (value?: string) => (value ?? '').trim().toLowerCase().replace(/[ -]+/g, '_');
export function deliveryKind(value?: string) {
  const k = key(value);
  if (/(^|_)(story|stories)(_|$)/.test(k) && !k.includes('highlight')) return 'story';
  const aliases: Record<string,string> = { ig_reel:'instagram_reel', ig_post:'instagram_post', ig_carousel_post:'instagram_post', mirrored_tt:'tiktok_video', tt_video:'tiktok_video', tiktok:'tiktok_video', tt:'tiktok_video' };
  return aliases[k] ?? k;
}
const platformAliases: Record<string, string> = { ig:'instagram', tt:'tiktok', yt:'youtube', fb:'facebook' };
const platformKey = (value?: string) => platformAliases[key(value)] ?? key(value);
export const requiresPublication = (type?: string) => /^(instagram|tiktok|youtube|facebook|snapchat|linkedin|twitter)_/.test(deliveryKind(type)) && deliveryKind(type) !== 'story';
function contentKey(url: string) {
  try { const u = new URL(url); return u.hostname.toLowerCase().replace(/^www\./,'') + u.pathname.replace(/\/$/,''); }
  catch { return url.trim(); }
}
/** One real Performance publication covers at most one contracted unit. */
export function publicationDeliveryCoverage(lineId: string, deliverables: RequiredDelivery[], publications: DeliveryPublication[]) {
  const used = new Set<string>();
  const seen = new Set<string>();
  const eligible = [...publications].sort((a,b) => Number(Boolean(b.assignment_post_schedule_id || b.assignment_deliverable_id)) - Number(Boolean(a.assignment_post_schedule_id || a.assignment_deliverable_id))).filter(p => {
    if (p.campaign_line_id !== lineId || !p.content_url || !['published','posted','live','verified'].includes(key(p.status))) return false;
    const identity = contentKey(p.content_url);
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  });
  return deliverables.map(d => {
    const matches = eligible.filter(p => !used.has(p.id) &&
      platformKey(p.platform) === platformKey(d.platform) && deliveryKind(p.publication_type) === deliveryKind(d.deliverable_type) &&
      (!p.assignment_deliverable_id || p.assignment_deliverable_id === d.id) &&
      (!p.assignment_post_schedule_id || d.posts.some(post => post.id === p.assignment_post_schedule_id)));
    const selected = matches.slice(0, Math.max(1, d.quantity));
    selected.forEach(p => used.add(p.id));
    return selected.length;
  });
}
