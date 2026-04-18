"use client";

import { useEffect, useRef, useState } from 'react';
import type { FeedSort, ForumPost } from '@/lib/types/forum';
import { fetchFeedPaged } from '@/lib/forum/client';
import { PostCard } from '@/components/forum/PostCard';
import { Skeleton } from '@/components/ui/skeleton';

interface ForumFeedProps {
  sort: FeedSort;
  subreddit?: string | null;
  pageSize?: number;
}

export function ForumFeed({ sort, subreddit = null, pageSize = 20 }: ForumFeedProps) {
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setPosts(null);
    setCursor(null);
    fetchFeedPaged({ sort, subreddit, pageSize }).then((res) => {
      if (!mounted) return;
      setPosts(res.items);
      setCursor(res.cursor);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [sort, subreddit, pageSize]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry.isIntersecting) return;
      if (isLoadingMore || !cursor) return;
      setIsLoadingMore(true);
      fetchFeedPaged({ sort, subreddit, pageSize, cursor })
        .then((res) => {
          setPosts((prev) => ([...(prev || []), ...res.items]));
          setCursor(res.cursor);
        })
        .finally(() => setIsLoadingMore(false));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, isLoadingMore, sort, subreddit, pageSize]);

  return (
    <div>
      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}
      {!!posts && (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          <div ref={sentinelRef} />
          {isLoadingMore && (
            <div className="py-4 space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          )}
        </div>
      )}
      {!loading && posts?.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <p>No posts yet.</p>
        </div>
      )}
    </div>
  );
}


