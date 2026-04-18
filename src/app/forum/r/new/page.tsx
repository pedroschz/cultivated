"use client";

import { FeedTabs } from '@/components/forum/FeedTabs';
import { ForumFeed } from '@/components/forum/ForumFeed';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SubredditNewInner() {
  const params = useSearchParams();
  const slug = (params?.get('slug') || '').trim();
  const query = slug ? `slug=${encodeURIComponent(slug)}` : undefined;
  return (
    <div>
      <FeedTabs basePath="/forum/r" query={query} />
      <ForumFeed sort="new" subreddit={slug || undefined} />
    </div>
  );
}

export default function SubredditNew() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <SubredditNewInner />
    </Suspense>
  );
}


