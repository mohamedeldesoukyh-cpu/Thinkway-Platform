/** Server-side resolution of TikTok share links; never follow arbitrary redirects. */
const resolvedLinks = new Map<string, { url: string; expires: number }>();

export async function resolvePublicationShareLinks<T extends { content_url: string | null }>(
  rows: T[],
  fetcher: typeof fetch = fetch,
): Promise<T[]> {
  const pending = new Map<string, Promise<string | null>>();
  return Promise.all(rows.map(async row => {
    if (!row.content_url) return row;
    let source: URL;
    try { source = new URL(row.content_url); } catch { return row; }
    if (source.protocol !== 'https:' || source.port || source.username || source.password ||
        !['vt.tiktok.com', 'vm.tiktok.com'].includes(source.hostname)) return row;
    const key = source.href;
    const cached = fetcher === fetch ? resolvedLinks.get(key) : undefined;
    if (cached && cached.expires > Date.now()) return { ...row, content_url: cached.url };
    if (!pending.has(key)) pending.set(key, (async () => {
      try {
        const response = await fetcher(key, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(3000) });
        const location = response.headers.get('location');
        if (response.status < 300 || response.status >= 400 || !location) return null;
        const target = new URL(location, key);
        if (target.protocol !== 'https:' || target.port || target.username || target.password ||
            !['www.tiktok.com', 'tiktok.com', 'm.tiktok.com'].includes(target.hostname) ||
            !/^\/@[^/]+\/video\/\d+\/?$/.test(target.pathname)) return null;
        target.search = '';
        target.hash = '';
        if (fetcher === fetch) {
          if (resolvedLinks.size >= 500) resolvedLinks.delete(resolvedLinks.keys().next().value!);
          resolvedLinks.set(key, { url: target.href, expires: Date.now() + 86_400_000 });
        }
        return target.href;
      } catch { return null; }
    })());
    const resolved = await pending.get(key);
    return resolved ? { ...row, content_url: resolved } : row;
  }));
}
