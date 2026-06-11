export type DiscoveryPlatform = "instagram" | "tiktok" | "youtube" | "twitter";

export type CrawledProfile = {
  platform: DiscoveryPlatform;
  username: string;
  profileUrl: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  followers?: number;
  following?: number;
  emailInBio?: string;
  metadata?: Record<string, unknown>;
};

export type CrawledPost = {
  platformPostId?: string;
  postUrl?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  views?: number;
  hashtags?: string[];
  postedAt?: string;
};

export type CrawledRelationship = {
  targetUsername: string;
  relationshipType: string;
  strength?: number;
};

export type PlatformCrawlResult = {
  profile: CrawledProfile;
  posts: CrawledPost[];
  relationships: CrawledRelationship[];
};
