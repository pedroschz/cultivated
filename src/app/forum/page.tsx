"use client";

import { FeedTabs } from '@/components/forum/FeedTabs';
import { ForumFeed } from '@/components/forum/ForumFeed';

export default function ForumHome() {
  return (
    <div>
      <FeedTabs basePath="/forum" />
      <ForumFeed sort="hot" />
    </div>
  );
}


