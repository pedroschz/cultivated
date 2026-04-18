/**
 * Forum data types used by client-only static forum pages.
 */

export type VoteValue = 1 | -1;

export interface ForumUserRef {
  uid: string;
  name?: string | null;
  username?: string | null;
  avatarIcon?: string | null;
  avatarColor?: string | null;
  isBot?: boolean;
  botId?: string | null;
}

export interface ForumPost {
  id: string;
  title: string;
  body?: string;
  author: ForumUserRef;
  subreddit?: string | null; // e.g., "math", "rw"
  voteScore: number; // denormalized for quick reads
  commentCount: number; // denormalized for quick reads
  createdAt: number; // ms
  updatedAt?: number; // ms
  isBot?: boolean;
  botId?: string | null;
  // optional enhancements for richer feeds
  hotScore?: number; // computed on client when votes change
  titleLower?: string; // for prefix search
  tags?: string[];
  flair?: string | null;
  media?: {
    type: 'image' | 'video' | 'link';
    url: string;
    thumbUrl?: string | null;
  } | null;
}

export interface ForumComment {
  id: string;
  postId: string;
  parentId?: string | null;
  body: string;
  author: ForumUserRef;
  voteScore: number;
  createdAt: number; // ms
  updatedAt?: number; // ms
  isBot?: boolean;
  botId?: string | null;
  path?: string; // e.g., root/parent/child for stable ordering (optional)
  childCount?: number;
}

export interface ForumVote {
  id: string; // `${userId}_${targetType}_${targetId}`
  userId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  value: VoteValue;
  createdAt: number;
}

export type FeedSort = 'hot' | 'new' | 'top';

// Communities
export interface ForumCommunity {
  id: string; // slug
  title: string;
  description?: string | null;
  icon?: string | null;
  bannerUrl?: string | null;
  subscriberCount?: number;
  createdAt: number;
  updatedAt?: number;
  rules?: string[];
}

// Relationships
export interface ForumUserSubscription {
  id: string; // `${uid}_${subreddit}`
  uid: string;
  subreddit: string;
  createdAt: number;
}

export interface ForumUserSave {
  id: string; // `${uid}_${postId}`
  uid: string;
  postId: string;
  createdAt: number;
}

// Hide feature removed

export interface ForumReport {
  id: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reporterUid: string;
  reason?: string | null;
  createdAt: number;
}

