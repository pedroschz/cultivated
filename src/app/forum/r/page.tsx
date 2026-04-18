"use client";

import { FeedTabs } from '@/components/forum/FeedTabs';
import { ForumFeed } from '@/components/forum/ForumFeed';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SubredditHotInner() {
  const params = useSearchParams();
  const slug = (params?.get('slug') || '').trim();
  const query = slug ? `slug=${encodeURIComponent(slug)}` : undefined;
  return (
    <div>
      <FeedTabs basePath="/forum/r" query={query} />
      <ForumFeed sort="hot" subreddit={slug || undefined} />
    </div>
  );
}

export default function SubredditHot() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <SubredditHotInner />
    </Suspense>
  );
}


