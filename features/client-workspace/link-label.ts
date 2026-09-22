export function clientLinkName(name?: string | null): string {
  return name?.replace(/\s+/g, ' ').trim() || 'Client workspace';
}

export function clientLinkShareText(name: string | null | undefined, url: string): string {
  return `${clientLinkName(name)}\n${url}`;
}
