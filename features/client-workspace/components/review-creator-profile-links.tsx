import type { ClientCreatorProfileLink } from "../platform-breakdown";
import { ReviewPlatformMark } from "./review-platform-mark";

export function ReviewCreatorProfileLinks({ links }: { links: ClientCreatorProfileLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="profile-links">
      {links.map((link) => (
        <a
          key={link.url}
          className="profile-link"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ReviewPlatformMark platform={link.platform} />
          <span className="u">
            {link.url.replace(/^https?:\/\//, "")}
            {link.handle ? <span className="h">{link.handle}</span> : null}
          </span>
        </a>
      ))}
    </div>
  );
}
