"use client";

import { FeedTabs } from '@/components/forum/FeedTabs';
import { ForumFeed } from '@/components/forum/ForumFeed';

export default function ForumNew() {
  return (
    <div>
      <FeedTabs basePath="/forum" />
      <ForumFeed sort="new" />
    </div>
  );
}


