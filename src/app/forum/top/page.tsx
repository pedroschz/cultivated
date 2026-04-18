"use client";

import { FeedTabs } from '@/components/forum/FeedTabs';
import { ForumFeed } from '@/components/forum/ForumFeed';

export default function ForumTop() {
  return (
    <div>
      <FeedTabs basePath="/forum" />
      <ForumFeed sort="top" />
    </div>
  );
}


